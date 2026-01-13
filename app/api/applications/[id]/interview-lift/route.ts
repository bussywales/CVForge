import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { fetchApplication } from "@/lib/data/applications";
import { listAchievements } from "@/lib/data/achievements";
import { listAutopacks } from "@/lib/data/autopacks";
import { fetchProfile } from "@/lib/data/profile";
import { listActiveDomainPacks } from "@/lib/data/domain-packs";
import { calculateRoleFit } from "@/lib/role-fit";
import type { RoleFitPack } from "@/lib/role-fit";
import { inferDomainGuess } from "@/lib/jd-learning";
import { buildInterviewLift } from "@/lib/interview-lift";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const application = await fetchApplication(supabase, user.id, params.id);
    if (!application) {
      return NextResponse.json(
        { error: "Application not found." },
        { status: 404 }
      );
    }

    const [profile, achievements, autopacks] = await Promise.all([
      fetchProfile(supabase, user.id),
      listAchievements(supabase, user.id),
      listAutopacks(supabase, user.id, application.id),
    ]);
    let dynamicPacks: RoleFitPack[] = [];
    try {
      dynamicPacks = await listActiveDomainPacks(supabase);
    } catch (error) {
      console.error("[interview-lift.packs]", error);
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

    return NextResponse.json({
      interviewLift,
      achievements: achievements.map((achievement) => ({
        id: achievement.id,
        title: achievement.title,
        metrics: achievement.metrics,
      })),
    });
  } catch (error) {
    console.error("[interview-lift.fetch]", error);
    return NextResponse.json(
      { error: "Unable to load interview lift data." },
      { status: 500 }
    );
  }
}
