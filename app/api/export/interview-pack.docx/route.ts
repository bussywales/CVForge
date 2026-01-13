import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { fetchApplication } from "@/lib/data/applications";
import { listAchievements } from "@/lib/data/achievements";
import { listAutopacks } from "@/lib/data/autopacks";
import { listActiveDomainPacks } from "@/lib/data/domain-packs";
import { fetchProfile } from "@/lib/data/profile";
import { calculateRoleFit } from "@/lib/role-fit";
import type { RoleFitPack } from "@/lib/role-fit";
import { inferDomainGuess } from "@/lib/jd-learning";
import { buildInterviewLift } from "@/lib/interview-lift";
import { buildInterviewPack } from "@/lib/interview-pack";
import { buildInterviewPackDocx, packDoc } from "@/lib/export/docx";
import { resolveExportVariant } from "@/lib/export/export-utils";
import { buildInterviewPackFilename } from "@/lib/export/filename";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const supabase = createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const applicationId = searchParams.get("applicationId");

    if (!applicationId) {
      return NextResponse.json(
        { error: "Missing applicationId." },
        { status: 400 }
      );
    }

    const application = await fetchApplication(supabase, user.id, applicationId);

    if (!application) {
      return NextResponse.json(
        { error: "Application not found." },
        { status: 404 }
      );
    }

    const [profile, achievements, autopacks] = await Promise.all([
      fetchProfile(supabase, user.id),
      listAchievements(supabase, user.id),
      listAutopacks(supabase, user.id, applicationId),
    ]);

    let dynamicPacks: RoleFitPack[] = [];
    try {
      dynamicPacks = await listActiveDomainPacks(supabase);
    } catch (error) {
      console.error("[interview-pack.packs]", error);
    }

    const evidenceParts = [
      profile?.headline,
      ...achievements.map((achievement) =>
        [achievement.title, achievement.metrics].filter(Boolean).join(" ")
      ),
    ].filter(Boolean) as string[];
    const evidence = evidenceParts.join(" ").trim();

    const jobDescription = application.job_description ?? "";
    const domainGuess = inferDomainGuess(
      application.job_title ?? "",
      jobDescription
    );
    const roleFit = calculateRoleFit(jobDescription, evidence, {
      dynamicPacks,
      domainGuess,
    });

    const latestAutopack = autopacks[0];
    const interviewLift = buildInterviewLift({
      roleFit,
      jobDescription,
      evidence,
      cvText: latestAutopack?.cv_text ?? "",
      coverLetter: latestAutopack?.cover_letter ?? "",
      nextActionDue: application.next_action_due,
      lastLiftAction: application.last_lift_action,
    });

    const pack = buildInterviewPack({
      jobTitle: application.job_title,
      company: application.company_name ?? application.company,
      jobDescription,
      roleFit,
      interviewLift,
    });

    const variant = resolveExportVariant(
      new URL(request.url).searchParams.get("variant")
    );

    const fallbackName =
      profile?.full_name?.trim() ||
      user.email?.split("@")[0] ||
      "CVForge";

    const filename = buildInterviewPackFilename({
      name: fallbackName,
      role: application.job_title ?? null,
      company: application.company_name ?? application.company ?? null,
      variant,
    });

    const doc = buildInterviewPackDocx(profile, pack, {
      email: user.email ?? null,
      variant,
      contactText: latestAutopack?.cv_text ?? "",
    });

    const buffer = await packDoc(doc);

    return new Response(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": buffer.byteLength.toString(),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[interview-pack.export]", error);
    return NextResponse.json(
      {
        error: "Interview pack export failed",
        detail: String(
          error instanceof Error ? error.message : error ?? "Unknown error"
        ),
      },
      { status: 500 }
    );
  }
}
