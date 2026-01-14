import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import { fetchApplication } from "@/lib/data/applications";
import { listAchievements } from "@/lib/data/achievements";
import { listWorkHistory } from "@/lib/data/work-history";
import { fetchProfile } from "@/lib/data/profile";
import { listActiveDomainPacks } from "@/lib/data/domain-packs";
import { buildEvidenceBank, buildEvidenceSnippet, rankEvidenceForGap } from "@/lib/evidence";
import { getEffectiveJobText } from "@/lib/job-text";
import { inferDomainGuess } from "@/lib/jd-learning";
import type { RoleFitPack } from "@/lib/role-fit";
import { buildRoleFitSignals, calculateRoleFit, detectRoleFitPacks } from "@/lib/role-fit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const payloadSchema = z.object({
  applicationId: z.string().uuid(),
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
      console.error("[evidence.packs]", error);
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
    const packs = detectRoleFitPacks(jobDescription, {
      dynamicPacks,
      domainGuess,
    });
    const signals = buildRoleFitSignals(packs);
    const roleFit = calculateRoleFit(jobDescription, evidence, {
      dynamicPacks,
      domainGuess,
    });

    const evidenceBank = buildEvidenceBank({
      profileHeadline: profile?.headline,
      achievements,
      workHistory,
      signals,
    });

    const gaps = roleFit.gapSignals.map((gap) => {
      const suggestions = rankEvidenceForGap(gap.id, evidenceBank).map(
        (item) => {
          const snippet = buildEvidenceSnippet(item);
          return {
            id: item.id,
            kind: item.kind,
            title: item.title,
            text: item.text,
            shortSnippet: snippet.shortSnippet,
          };
        }
      );

      return {
        signalId: gap.id,
        label: gap.label,
        suggestedEvidence: suggestions,
      };
    });

    return NextResponse.json({ gaps });
  } catch (error) {
    console.error("[evidence.suggest]", error);
    return NextResponse.json(
      { error: "Unable to load evidence suggestions." },
      { status: 500 }
    );
  }
}
