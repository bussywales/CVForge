import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { fetchApplication } from "@/lib/data/applications";
import { listAchievements } from "@/lib/data/achievements";
import { fetchProfile } from "@/lib/data/profile";
import { listActiveDomainPacks } from "@/lib/data/domain-packs";
import { calculateRoleFit } from "@/lib/role-fit";
import type { RoleFitPack } from "@/lib/role-fit";
import { inferDomainGuess } from "@/lib/jd-learning";
import {
  getNextOutreachStep,
  renderOutreachTemplate,
} from "@/lib/outreach-templates";
import type { OutreachStage } from "@/lib/outreach-templates";
import { getOutreachStageLabel, pickBestMetric, pickTopSignals } from "@/lib/outreach-utils";

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

    const [profile, achievements] = await Promise.all([
      fetchProfile(supabase, user.id),
      listAchievements(supabase, user.id),
    ]);

    let dynamicPacks: RoleFitPack[] = [];
    try {
      dynamicPacks = await listActiveDomainPacks(supabase);
    } catch (error) {
      console.error("[outreach.packs]", error);
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

    const topSignals = pickTopSignals(roleFit, 2);
    const bestMetric = pickBestMetric(achievements);
    const stage = application.outreach_stage ?? "not_started";
    const nextStep = getNextOutreachStep(stage as OutreachStage);
    const channelPref =
      application.outreach_channel_pref === "linkedin" ? "linkedin" : "email";

    const templates = nextStep
      ? {
          email: renderOutreachTemplate({
            channel: "email",
            step: nextStep,
            application,
            profile,
            roleFitTopSignals: topSignals,
            bestMetric,
          }),
          linkedin: renderOutreachTemplate({
            channel: "linkedin",
            step: nextStep,
            application,
            profile,
            roleFitTopSignals: topSignals,
            bestMetric,
          }),
        }
      : null;

    return NextResponse.json({
      outreach: {
        stage,
        stageLabel: getOutreachStageLabel(stage),
        channelPref,
        nextStep: nextStep
          ? {
              id: nextStep.id,
              label: nextStep.label,
              stage: nextStep.stage,
              offsetDays: nextStep.offsetDays,
            }
          : null,
        nextDueAt: application.outreach_next_due_at,
        signals: topSignals,
        metric: bestMetric,
        templates,
      },
    });
  } catch (error) {
    console.error("[outreach.fetch]", error);
    return NextResponse.json(
      { error: "Unable to load outreach data." },
      { status: 500 }
    );
  }
}
