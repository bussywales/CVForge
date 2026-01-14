import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import { fetchApplication, updateApplication } from "@/lib/data/applications";
import { listAchievements } from "@/lib/data/achievements";
import { listWorkHistory } from "@/lib/data/work-history";
import { fetchProfile } from "@/lib/data/profile";
import { listActiveDomainPacks } from "@/lib/data/domain-packs";
import { createApplicationActivity } from "@/lib/data/application-activities";
import {
  buildEvidenceGapKey,
  upsertApplicationEvidence,
} from "@/lib/data/application-evidence";
import {
  buildEvidenceBank,
  buildEvidenceSnippet,
  dedupeSelectedEvidence,
  findEvidenceById,
  normalizeSelectedEvidence,
  type SelectedEvidenceEntry,
} from "@/lib/evidence";
import { getEffectiveJobText } from "@/lib/job-text";
import { inferDomainGuess } from "@/lib/jd-learning";
import type { RoleFitPack } from "@/lib/role-fit";
import { buildRoleFitSignals, detectRoleFitPacks } from "@/lib/role-fit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const payloadSchema = z.object({
  applicationId: z.string().uuid(),
  evidenceId: z.string().min(3),
  signalId: z.string().min(2),
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
      console.error("[evidence.select.packs]", error);
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
      profileLocation: profile?.location,
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

    const snippet = buildEvidenceSnippet(evidenceItem).shortSnippet;
    const now = new Date().toISOString();
    const entry: SelectedEvidenceEntry = {
      id: evidenceItem.id,
      kind: evidenceItem.kind,
      signalId: parsed.data.signalId,
      note: snippet,
      createdAt: now,
    };

    const existing = normalizeSelectedEvidence(application.selected_evidence);
    const updated = dedupeSelectedEvidence([...existing, entry]);

    const matchScore = evidenceItem.matchScores[parsed.data.signalId] ?? 0;

    try {
      await upsertApplicationEvidence(supabase, user.id, {
        application_id: application.id,
        gap_key: buildEvidenceGapKey(parsed.data.signalId, evidenceItem.id),
        evidence_id: evidenceItem.id,
        source_type: evidenceItem.sourceType,
        source_id: evidenceItem.sourceId,
        match_score: matchScore,
        quality_score: evidenceItem.qualityScore,
      });
    } catch (error) {
      console.error("[evidence.select.persist]", error);
    }

    await updateApplication(supabase, user.id, application.id, {
      selected_evidence: updated,
    });

    try {
      await createApplicationActivity(supabase, user.id, {
        application_id: application.id,
        type: "evidence.select",
        channel: null,
        subject: "Evidence selected",
        body: JSON.stringify({
          evidenceId: entry.id,
          signalId: entry.signalId,
        }),
        occurred_at: now,
      });
    } catch (error) {
      console.error("[evidence.select.activity]", error);
    }

    return NextResponse.json({ selectedEvidence: updated });
  } catch (error) {
    console.error("[evidence.select]", error);
    return NextResponse.json(
      { error: "Unable to select evidence right now." },
      { status: 500 }
    );
  }
}
