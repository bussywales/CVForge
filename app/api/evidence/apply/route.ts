import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import { fetchApplication, updateApplication } from "@/lib/data/applications";
import { listAchievements, updateAchievement, createAchievement } from "@/lib/data/achievements";
import { listWorkHistory } from "@/lib/data/work-history";
import { fetchProfile } from "@/lib/data/profile";
import { listActiveDomainPacks } from "@/lib/data/domain-packs";
import { createApplicationActivity } from "@/lib/data/application-activities";
import {
  buildEvidenceBank,
  buildEvidenceSnippet,
  findEvidenceById,
} from "@/lib/evidence";
import { getEffectiveJobText } from "@/lib/job-text";
import { inferDomainGuess } from "@/lib/jd-learning";
import type { RoleFitPack } from "@/lib/role-fit";
import { buildRoleFitSignals, detectRoleFitPacks } from "@/lib/role-fit";
import { buildStarDraft } from "@/lib/star-draft";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const payloadSchema = z.object({
  applicationId: z.string().uuid(),
  evidenceId: z.string().min(3),
  signalId: z.string().min(2),
  mode: z.enum([
    "create_draft_achievement",
    "insert_clause_metric",
    "attach_to_star",
  ]),
});

export async function POST(request: Request) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = payloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  try {
    const application = await fetchApplication(
      supabase,
      user.id,
      parsed.data.applicationId
    );

    if (!application) {
      return NextResponse.json(
        { error: "Application not found." },
        { status: 404 }
      );
    }

    const [profile, achievements, workHistory] = await Promise.all([
      fetchProfile(supabase, user.id),
      listAchievements(supabase, user.id),
      listWorkHistory(supabase, user.id),
    ]);

    let dynamicPacks: RoleFitPack[] = [];
    try {
      dynamicPacks = await listActiveDomainPacks(supabase);
    } catch (error) {
      console.error("[evidence.apply.packs]", error);
    }

    const jobDescription = getEffectiveJobText(application);
    const domainGuess = inferDomainGuess(
      application.job_title ?? "",
      jobDescription
    );
    const packs = detectRoleFitPacks(jobDescription, {
      dynamicPacks,
      domainGuess,
    });
    const signals = buildRoleFitSignals(packs);

    const evidenceBank = buildEvidenceBank({
      profileHeadline: profile?.headline,
      achievements,
      workHistory,
      signals,
    });

    const evidenceItem = findEvidenceById(evidenceBank, parsed.data.evidenceId);
    if (!evidenceItem) {
      return NextResponse.json(
        { error: "Evidence item not found." },
        { status: 404 }
      );
    }

    const snippet = buildEvidenceSnippet(evidenceItem);
    const now = new Date().toISOString();

    if (parsed.data.mode === "create_draft_achievement") {
      const actionText = ensureMinActionLength(snippet.snippet);
      await createAchievement(supabase, user.id, {
        title: evidenceItem.title,
        situation: "",
        task: "",
        action: actionText,
        result: "",
        metrics: "",
      });
    }

    if (parsed.data.mode === "insert_clause_metric") {
      const target = pickTargetAchievement(
        achievements,
        evidenceBank,
        evidenceItem.id,
        parsed.data.signalId
      );
      if (!target) {
        return NextResponse.json(
          { error: "Add an achievement before inserting metrics." },
          { status: 400 }
        );
      }
      const metricClause = toMetricClause(snippet.shortSnippet);
      const updatedMetrics = appendMetrics(target.metrics ?? "", metricClause);
      if (!updatedMetrics) {
        return NextResponse.json(
          {
            error: "Metric too long to insert. Consider creating a draft achievement instead.",
          },
          { status: 400 }
        );
      }
      await updateAchievement(supabase, user.id, target.id, {
        metrics: updatedMetrics,
      });
    }

    if (parsed.data.mode === "attach_to_star") {
      const currentDrafts = Array.isArray(application.star_drafts)
        ? application.star_drafts
        : [];
      const drafts = [...currentDrafts] as Array<{
        requirement?: string;
        question?: string;
        answer?: string;
      }>;

      let draft = drafts[0];
      if (!draft) {
        draft = buildStarDraft({
          jobDescription,
          achievementTitle: evidenceItem.title,
        });
        drafts.push(draft);
      }

      const answer = draft.answer ?? "";
      draft.answer = appendEvidence(answer, snippet.shortSnippet);

      await updateApplication(supabase, user.id, application.id, {
        star_drafts: drafts,
      });
    }

    try {
      await createApplicationActivity(supabase, user.id, {
        application_id: application.id,
        type: "evidence.apply",
        channel: null,
        subject: "Evidence applied",
        body: JSON.stringify({
          mode: parsed.data.mode,
          evidenceId: evidenceItem.id,
          signalId: parsed.data.signalId,
        }),
        occurred_at: now,
      });
    } catch (error) {
      console.error("[evidence.apply.activity]", error);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[evidence.apply]", error);
    return NextResponse.json(
      { error: "Unable to apply evidence right now." },
      { status: 500 }
    );
  }
}

function appendMetrics(current: string, clause: string) {
  const trimmedCurrent = current.trim();
  const trimmedClause = clause.trim();
  if (!trimmedClause) {
    return trimmedCurrent;
  }
  const combined = trimmedCurrent
    ? `${trimmedCurrent.replace(/[.;:,]+$/g, "")}; ${trimmedClause}`
    : trimmedClause;
  return combined.length <= 120 ? combined : null;
}

function appendEvidence(current: string, clause: string) {
  const trimmedClause = clause.trim();
  if (!trimmedClause) {
    return current;
  }
  if (current.includes(trimmedClause)) {
    return current;
  }
  return `${current}\nEvidence: ${trimmedClause}`.trim();
}

function ensureMinActionLength(value: string) {
  if (value.trim().length >= 20) {
    return value;
  }
  return `${value.trim()} Add detail on scope and outcomes.`.trim();
}

function toMetricClause(value: string) {
  let clause = value.trim();
  clause = clause.replace(/^Evidence:\s*/i, "");
  clause = clause.replace(/^From [^:]+:\s*/i, "");
  return clause;
}

function pickTargetAchievement(
  achievements: Array<{ id: string; metrics: string | null }>,
  evidenceBank: ReturnType<typeof buildEvidenceBank>,
  evidenceId: string,
  signalId: string
) {
  const direct = evidenceId.startsWith("ach:")
    ? achievements.find((achievement) => achievement.id === evidenceId.slice(4))
    : null;
  if (direct) {
    return direct;
  }

  const candidates = evidenceBank.items
    .filter((item) => item.kind === "achievement")
    .filter((item) => item.signals.includes(signalId))
    .sort((a, b) => b.weight - a.weight);

  if (candidates.length > 0) {
    const targetId = candidates[0].id.replace("ach:", "");
    return achievements.find((achievement) => achievement.id === targetId) ?? null;
  }

  return achievements[0] ?? null;
}
