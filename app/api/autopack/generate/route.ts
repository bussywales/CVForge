import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { fetchApplication } from "@/lib/data/applications";
import { ensureProfile } from "@/lib/data/profile";
import { listAchievements } from "@/lib/data/achievements";
import { fetchLatestAutopackVersion } from "@/lib/data/autopacks";
import { fetchLatestAuditLog, insertAuditLog } from "@/lib/data/audit-log";
import { deductCreditForAutopack, getUserCredits } from "@/lib/data/credits";
import { listWorkHistory } from "@/lib/data/work-history";
import { listActiveDomainPacks } from "@/lib/data/domain-packs";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { getEffectiveJobText } from "@/lib/job-text";
import {
  buildEvidenceBank,
  buildSelectedEvidenceSnippets,
  normalizeSelectedEvidence,
} from "@/lib/evidence";
import { inferDomainGuess } from "@/lib/jd-learning";
import type { RoleFitPack } from "@/lib/role-fit";
import { buildRoleFitSignals, detectRoleFitPacks } from "@/lib/role-fit";
import {
  autopackAiOutputSchema,
  generateAutopackSchema,
} from "@/lib/validators/autopack";
import { getFieldErrors } from "@/lib/validators/utils";
import {
  sanitizeInlineText,
  sanitizeJsonStrings,
  sanitizeTextContent,
} from "@/lib/utils/autopack-sanitize";

export const runtime = "nodejs";

const JOB_DESCRIPTION_MAX = 12000;
const ACHIEVEMENTS_MAX = 10000;
const RATE_LIMIT_SECONDS = 30;

function truncateText(text: string, maxLength: number) {
  if (text.length <= maxLength) {
    return { value: text, truncated: false };
  }
  return { value: text.slice(0, maxLength), truncated: true };
}

function serializeAchievements(
  achievements: Array<{
    title: string;
    situation: string | null;
    task: string | null;
    action: string | null;
    result: string | null;
    metrics: string | null;
  }>
) {
  return achievements
    .map((achievement, index) => {
      return [
        `Achievement ${index + 1}: ${achievement.title}`,
        achievement.situation ? `Situation: ${achievement.situation}` : null,
        achievement.task ? `Task: ${achievement.task}` : null,
        achievement.action ? `Action: ${achievement.action}` : null,
        achievement.result ? `Result: ${achievement.result}` : null,
        achievement.metrics ? `Metrics: ${achievement.metrics}` : null,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
}

function parseJsonFromContent(content: string) {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("No JSON object found in response.");
  }
  const slice = content.slice(start, end + 1);
  return JSON.parse(slice);
}

async function callOpenAI<T>(payload: {
  messages: Array<{ role: "system" | "user"; content: string }>;
  temperature?: number;
  maxTokens?: number;
}) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: payload.temperature ?? 0.2,
      max_tokens: payload.maxTokens ?? 2000,
      messages: payload.messages,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenAI request failed: ${errorBody}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("OpenAI response missing content.");
  }

  return parseJsonFromContent(content) as T;
}

export async function POST(request: Request) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsedInput = generateAutopackSchema.safeParse(body);

  if (!parsedInput.success) {
    return NextResponse.json(
      {
        error: "Invalid payload",
        fieldErrors: getFieldErrors(parsedInput.error),
      },
      { status: 400 }
    );
  }

  try {
    const isProduction =
      process.env.VERCEL_ENV === "production" ||
      process.env.NODE_ENV === "production";
    const allowNoCredits =
      !isProduction && process.env.CVFORGE_ALLOW_NO_CREDITS === "true";
    const credits = await getUserCredits(supabase, user.id);

    if (credits <= 0 && !allowNoCredits) {
      return NextResponse.json(
        {
          error:
            "You're out of credits. Visit billing to top up and generate a new pack.",
          billingUrl: "/app/billing",
        },
        { status: 402 }
      );
    }

    const lastGenerate = await fetchLatestAuditLog(
      supabase,
      user.id,
      "autopack.generate"
    );

    if (lastGenerate?.created_at) {
      const lastTime = new Date(lastGenerate.created_at).getTime();
      const now = Date.now();
      if ((now - lastTime) / 1000 < RATE_LIMIT_SECONDS) {
        return NextResponse.json(
          { error: "Please wait a moment before generating another pack." },
          { status: 429 }
        );
      }
    }

    const application = await fetchApplication(
      supabase,
      user.id,
      parsedInput.data.applicationId
    );

    if (!application) {
      return NextResponse.json(
        { error: "Application not found." },
        { status: 404 }
      );
    }

    const [profile, achievements, workHistory] = await Promise.all([
      ensureProfile(supabase, user.id),
      listAchievements(supabase, user.id),
      listWorkHistory(supabase, user.id),
    ]);

    let dynamicPacks: RoleFitPack[] = [];
    try {
      dynamicPacks = await listActiveDomainPacks(supabase);
    } catch (error) {
      console.error("[autopack.packs]", error);
    }

    const selectedEvidence = normalizeSelectedEvidence(
      application.selected_evidence
    );

    const generationNotes: string[] = [];

    const effectiveJobText = getEffectiveJobText(application);
    const jobDescriptionResult = truncateText(
      effectiveJobText,
      JOB_DESCRIPTION_MAX
    );

    if (jobDescriptionResult.truncated) {
      generationNotes.push(
        "Job description was truncated to fit the prompt limit."
      );
    }

    const achievementsText = serializeAchievements(achievements);
    const achievementsResult = truncateText(
      achievementsText,
      ACHIEVEMENTS_MAX
    );

    if (achievementsResult.truncated) {
      generationNotes.push(
        "Achievements evidence was truncated to fit the prompt limit."
      );
    }

    const profileSummary = [
      `Full name: ${profile.full_name ?? ""}`.trim(),
      profile.headline ? `Headline: ${profile.headline}` : null,
      profile.location ? `Location: ${profile.location}` : null,
    ]
      .filter(Boolean)
      .join("\n");
    const applicationSummary = [
      `Job title: ${application.job_title}`,
      application.company ? `Company: ${application.company}` : "Company: N/A",
    ].join("\n");

    const extractedRequirements = await callOpenAI<{
      responsibilities: string[];
      required_skills: string[];
      nice_to_have: string[];
      keywords: string[];
      seniority: string;
      role_summary: string;
    }>({
      messages: [
        {
          role: "system",
          content:
            "Extract structured job requirements. Return JSON with keys: responsibilities, required_skills, nice_to_have, keywords, seniority, role_summary.",
        },
        {
          role: "user",
          content: `Job description:\n${jobDescriptionResult.value}`,
        },
      ],
      temperature: 0,
      maxTokens: 900,
    });

    const aiOutput = await callOpenAI({
      messages: [
        {
          role: "system",
          content:
            "You are CVForge. Use ONLY the provided profile and achievements. Do not invent employers, dates, or qualifications. If evidence is missing, use placeholders like [Add metric] and list them in an 'Assumptions/Needs verification' section. Return JSON only with keys: cv_text, cover_letter, answers_json, change_log, assumptions.",
        },
        {
          role: "user",
          content: [
            "PROFILE",
            profileSummary || "No profile details provided.",
            "",
            "APPLICATION",
            applicationSummary,
            "",
            "ACHIEVEMENTS",
            achievementsResult.value || "No achievements provided.",
            "",
            "EXTRACTED REQUIREMENTS",
            JSON.stringify(extractedRequirements, null, 2),
            "",
            "GENERATION NOTES",
            generationNotes.length > 0 ? generationNotes.join("\n") : "None.",
            "",
            "Instructions:",
            "- Create an ATS-friendly UK CV (no tables), bullet achievements, include 'Assumptions/Needs verification' section.",
            "- Create a UK cover letter (250-400 words) referencing the role/company if available.",
            "- answers_json should be 5-8 STAR answers with requirement, question, answer.",
            "- change_log should list key tailoring decisions and evidence sources.",
          ].join("\n"),
        },
      ],
      temperature: 0.2,
      maxTokens: 2400,
    });

    const parsedOutput = autopackAiOutputSchema.safeParse(aiOutput);

    if (!parsedOutput.success) {
      throw new Error("OpenAI output failed validation.");
    }

    const sanitizedCvText = sanitizeTextContent(parsedOutput.data.cv_text);
    const sanitizedCoverLetter = sanitizeTextContent(
      parsedOutput.data.cover_letter
    );
    const sanitizedAnswers = sanitizeJsonStrings(
      parsedOutput.data.answers_json
    );
    const sanitizedChangeLog = parsedOutput.data.change_log
      .map((entry) => sanitizeInlineText(entry))
      .filter(Boolean);
    const sanitizedAssumptions = (parsedOutput.data.assumptions ?? [])
      .map((entry) => sanitizeInlineText(entry))
      .filter(Boolean);

    const domainGuess = inferDomainGuess(
      application.job_title ?? "",
      effectiveJobText
    );
    const packs = detectRoleFitPacks(effectiveJobText, {
      dynamicPacks,
      domainGuess,
    });
    const signals = buildRoleFitSignals(packs);
    const evidenceBank = buildEvidenceBank({
      profileHeadline: profile.headline,
      achievements,
      workHistory,
      signals,
    });
    const evidenceSnippets = buildSelectedEvidenceSnippets(
      selectedEvidence,
      evidenceBank,
      6
    )
      .map((snippet) => sanitizeInlineText(snippet))
      .filter(Boolean);
    const cvWithEvidence = evidenceSnippets.length
      ? `${sanitizedCvText}\n\nSelected evidence for this role\n${evidenceSnippets.map((snippet) => `- ${snippet}`).join("\n")}`
      : sanitizedCvText;
    const coverWithEvidence = evidenceSnippets.length
      ? `${sanitizedCoverLetter}\n\nEvidence highlights: ${evidenceSnippets.slice(0, 2).join(" ")}`
      : sanitizedCoverLetter;

    const latestVersion = await fetchLatestAutopackVersion(
      supabase,
      user.id,
      application.id
    );
    const nextVersion = latestVersion + 1;

    const answersPayload = {
      requirements: sanitizedAnswers,
      change_log: sanitizedChangeLog,
      extracted_requirements: extractedRequirements,
      ...(evidenceSnippets.length > 0 ? { evidence: evidenceSnippets } : {}),
      ...(sanitizedAssumptions.length > 0
        ? { assumptions: sanitizedAssumptions }
        : {}),
    };

    const { data: insertedAutopack, error: insertError } = await supabase
      .from("autopacks")
      .insert({
        application_id: application.id,
        user_id: user.id,
        version: nextVersion,
        cv_text: cvWithEvidence,
        cover_letter: coverWithEvidence,
        answers_json: answersPayload,
      })
      .select("id, version")
      .single();

    if (insertError || !insertedAutopack) {
      throw insertError ?? new Error("Failed to create autopack.");
    }

    await insertAuditLog(supabase, {
      user_id: user.id,
      action: "credits.deduct_attempt",
      meta: {
        applicationId: application.id,
        autopackId: insertedAutopack.id,
        version: insertedAutopack.version,
      },
    });

    await insertAuditLog(supabase, {
      user_id: user.id,
      action: "autopack.generate",
      meta: {
        applicationId: application.id,
        autopackId: insertedAutopack.id,
        version: insertedAutopack.version,
      },
    });

    const skipDeduction = allowNoCredits && credits <= 0;

    if (!skipDeduction) {
      let serviceClient: ReturnType<typeof createServiceRoleClient> | null =
        null;

      try {
        serviceClient = createServiceRoleClient();
        await deductCreditForAutopack(
          user.id,
          insertedAutopack.id,
          serviceClient
        );
        await insertAuditLog(serviceClient, {
          user_id: user.id,
          action: "credits.deduct_success",
          meta: {
            autopackId: insertedAutopack.id,
          },
        });
      } catch (error) {
        console.error("[credits.deduct_failed]", error);
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        let auditLogged = false;

        try {
          const auditClient = serviceClient ?? createServiceRoleClient();
          await insertAuditLog(auditClient, {
            user_id: user.id,
            action: "credits.deduct_failed",
            meta: {
              autopackId: insertedAutopack.id,
              error: errorMessage,
            },
          });
          auditLogged = true;
        } catch (auditError) {
          console.error("[credits.deduct_failed audit]", auditError);
        }

        if (!auditLogged) {
          try {
            await insertAuditLog(supabase, {
              user_id: user.id,
              action: "credits.deduct_failed",
              meta: {
                autopackId: insertedAutopack.id,
                error: errorMessage,
              },
            });
          } catch (auditError) {
            console.error("[credits.deduct_failed audit fallback]", auditError);
          }
        }

        try {
          const deleteClient = serviceClient ?? supabase;
          await deleteClient
            .from("autopacks")
            .delete()
            .eq("id", insertedAutopack.id)
            .eq("user_id", user.id);
        } catch (deleteError) {
          console.error("[autopack rollback failed]", deleteError);
        }

        return NextResponse.json(
          {
            error:
              "Unable to finalize credits for this autopack. Please try again.",
          },
          { status: 500 }
        );
      }
    }

    const creditsRemaining = skipDeduction
      ? credits
      : Math.max(credits - 1, 0);

    return NextResponse.json({
      autopackId: insertedAutopack.id,
      version: insertedAutopack.version,
      creditsRemaining,
      creditUsed: !skipDeduction,
    });
  } catch (error) {
    console.error("[autopack.generate]", error);

    try {
      await insertAuditLog(supabase, {
        user_id: user.id,
        action: "autopack.generate_failed",
        meta: {
          applicationId: parsedInput.data.applicationId,
          error: error instanceof Error ? error.message : "Unknown error",
        },
      });
    } catch (auditError) {
      console.error("[autopack.generate_failed audit]", auditError);
    }

    return NextResponse.json(
      { error: "Unable to generate autopack right now." },
      { status: 500 }
    );
  }
}
