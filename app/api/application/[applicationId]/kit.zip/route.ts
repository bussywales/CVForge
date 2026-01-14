import { NextResponse } from "next/server";
import archiver from "archiver";
import { PassThrough, Readable } from "stream";
import { createServerClient } from "@/lib/supabase/server";
import { fetchApplication } from "@/lib/data/applications";
import { listAchievements } from "@/lib/data/achievements";
import { listAutopacks } from "@/lib/data/autopacks";
import { listActiveDomainPacks } from "@/lib/data/domain-packs";
import { fetchProfile } from "@/lib/data/profile";
import { listWorkHistory } from "@/lib/data/work-history";
import { createApplicationActivity } from "@/lib/data/application-activities";
import { markApplyChecklist } from "@/lib/apply-checklist";
import { calculateRoleFit } from "@/lib/role-fit";
import type { RoleFitPack } from "@/lib/role-fit";
import { inferDomainGuess } from "@/lib/jd-learning";
import { buildInterviewLift } from "@/lib/interview-lift";
import { buildInterviewPack } from "@/lib/interview-pack";
import {
  buildCvDocx,
  buildCoverLetterDocx,
  buildInterviewPackDocx,
  packDoc,
} from "@/lib/export/docx";
import { sanitizeForExport, sanitizeJsonForExport } from "@/lib/export/export-utils";
import {
  buildApplicationKitFilename,
  buildKitStarDraftsPayload,
  getKitContentsList,
  type KitPracticeAnswer,
} from "@/lib/application-kit";
import { getEffectiveJobText } from "@/lib/job-text";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: { applicationId: string } }
) {
  try {
    const supabase = createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const application = await fetchApplication(
      supabase,
      user.id,
      params.applicationId
    );

    if (!application) {
      return NextResponse.json(
        { error: "Application not found." },
        { status: 404 }
      );
    }

    const autopacks = await listAutopacks(
      supabase,
      user.id,
      application.id
    );
    const latestAutopack = autopacks[0];

    if (!latestAutopack) {
      return NextResponse.json(
        { error: "Generate an autopack first." },
        { status: 404 }
      );
    }

    if (!latestAutopack.cv_text || !latestAutopack.cover_letter) {
      return NextResponse.json(
        { error: "Autopack content is incomplete." },
        { status: 400 }
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
      console.error("[kit.packs]", error);
    }

    const evidenceParts = [
      profile?.headline,
      ...achievements.map((achievement) =>
        [achievement.title, achievement.metrics].filter(Boolean).join(" ")
      ),
    ].filter(Boolean) as string[];
    const evidence = evidenceParts.join(" ").trim();

    const jobDescription = getEffectiveJobText(application);
    const domainGuess = inferDomainGuess(
      application.job_title ?? "",
      jobDescription
    );
    const roleFit = calculateRoleFit(jobDescription, evidence, {
      dynamicPacks,
      domainGuess,
    });

    const interviewLift = buildInterviewLift({
      roleFit,
      jobDescription,
      evidence,
      cvText: latestAutopack.cv_text,
      coverLetter: latestAutopack.cover_letter,
      nextActionDue: application.next_action_due,
      lastLiftAction: application.last_lift_action,
    });

    const interviewPack = buildInterviewPack({
      jobTitle: application.job_title,
      company: application.company_name ?? application.company,
      jobDescription,
      roleFit,
      interviewLift,
    });

    const sanitizedCvText = sanitizeForExport(latestAutopack.cv_text);
    const sanitizedCoverLetter = sanitizeForExport(latestAutopack.cover_letter);

    const cvDoc = buildCvDocx(profile, sanitizedCvText, {
      email: user.email ?? null,
      variant: "ats_minimal",
      workHistory,
    });
    const coverDoc = buildCoverLetterDocx(profile, sanitizedCoverLetter, {
      email: user.email ?? null,
      contactText: sanitizedCvText,
      variant: "ats_minimal",
      recipientName: application.contact_name ?? null,
      companyName: application.company_name ?? application.company ?? null,
    });
    const interviewDoc = buildInterviewPackDocx(profile, interviewPack, {
      email: user.email ?? null,
      variant: "standard",
      contactText: sanitizedCvText,
    });

    const [cvBuffer, coverBuffer, interviewBuffer] = await Promise.all([
      packDoc(cvDoc),
      packDoc(coverDoc),
      packDoc(interviewDoc),
    ]);

    let practiceAnswers: KitPracticeAnswer[] = [];
    try {
      const { data, error } = await supabase
        .from("interview_practice_answers")
        .select(
          "question_key, question_text, answer_text, rubric_json, score, improved_text, updated_at"
        )
        .eq("user_id", user.id)
        .eq("application_id", application.id);

      if (error) {
        console.error("[kit.practice]", error);
      } else {
        practiceAnswers = (data ?? []) as KitPracticeAnswer[];
      }
    } catch (error) {
      console.error("[kit.practice]", error);
    }

    const starDrafts = sanitizeJsonForExport(
      buildKitStarDraftsPayload(practiceAnswers, application.star_drafts)
    );
    const starJson = JSON.stringify(starDrafts, null, 2);

    const fallbackName =
      profile?.full_name?.trim() ||
      user.email?.split("@")[0] ||
      "CVForge";

    const zipFilename = buildApplicationKitFilename(
      fallbackName,
      application.job_title ?? null
    );

    const contents = getKitContentsList();

    const archive = archiver("zip", { zlib: { level: 9 } });
    const stream = new PassThrough();

    archive.on("error", (error) => {
      console.error("[kit.zip]", error);
      stream.destroy(error as Error);
    });

    archive.pipe(stream);
    archive.append(cvBuffer, { name: contents[0] });
    archive.append(coverBuffer, { name: contents[1] });
    archive.append(interviewBuffer, { name: contents[2] });
    archive.append(starJson, { name: contents[3] });
    void archive.finalize();

    try {
      await createApplicationActivity(supabase, user.id, {
        application_id: application.id,
        type: "kit.download",
        channel: null,
        subject: "Application kit downloaded",
        body: JSON.stringify({
          variant: "v1",
          included: ["cv", "cover_letter", "interview_pack", "star_json"],
        }),
        occurred_at: new Date().toISOString(),
      });
    } catch (activityError) {
      console.error("[kit.activity]", activityError);
    }

    try {
      await markApplyChecklist(supabase, user.id, application.id, {
        kit_downloaded_at: new Date().toISOString(),
      });
    } catch (checklistError) {
      console.error("[kit.checklist]", checklistError);
    }

    return new Response(Readable.toWeb(stream) as unknown as ReadableStream, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${zipFilename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[kit.export]", error);
    return NextResponse.json(
      {
        error: "Application kit export failed",
        detail: String(
          error instanceof Error ? error.message : error ?? "Unknown error"
        ),
      },
      { status: 500 }
    );
  }
}
