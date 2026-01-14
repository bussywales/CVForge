import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import { fetchApplication } from "@/lib/data/applications";
import { fetchProfile } from "@/lib/data/profile";
import { listAchievements } from "@/lib/data/achievements";
import { listWorkHistory } from "@/lib/data/work-history";
import { listActiveDomainPacks } from "@/lib/data/domain-packs";
import {
  listApplicationEvidenceRows,
  normalizeGapKey,
  type ApplicationEvidenceRow,
} from "@/lib/data/application-evidence";
import { upsertStarLibrary } from "@/lib/data/star-library";
import { insertAuditLog } from "@/lib/data/audit-log";
import {
  buildEvidenceBank,
  buildEvidenceSnippet,
  normalizeSelectedEvidence,
} from "@/lib/evidence";
import { buildStarDraftPrefill, isLikelyUuid } from "@/lib/star-library";
import { getEffectiveJobText } from "@/lib/job-text";
import { inferDomainGuess } from "@/lib/jd-learning";
import { calculateRoleFit, buildRoleFitSignals, detectRoleFitPacks } from "@/lib/role-fit";
import type { RoleFitPack } from "@/lib/role-fit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const payloadSchema = z.object({
  applicationId: z.string().uuid(),
  gapKey: z.string().min(2),
  title: z.string().max(120).optional(),
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
      console.error("[star-library.packs]", error);
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
    const evidenceParts = [
      profile?.headline,
      ...achievements.map((achievement) =>
        [achievement.title, achievement.metrics].filter(Boolean).join(" ")
      ),
    ].filter(Boolean) as string[];
    const evidenceText = evidenceParts.join(" ").trim();
    const roleFit = calculateRoleFit(jobDescription, evidenceText, {
      dynamicPacks,
      domainGuess,
    });
    const gapSignal = roleFit.gapSignals.find(
      (gap) => gap.id === parsed.data.gapKey
    );

    const evidenceBank = buildEvidenceBank({
      profileHeadline: profile?.headline,
      profileLocation: profile?.location,
      achievements,
      workHistory,
      signals,
    });

    let evidenceRows: ApplicationEvidenceRow[] = [];
    try {
      evidenceRows = await listApplicationEvidenceRows(
        supabase,
        user.id,
        application.id
      );
    } catch (error) {
      console.error("[star-library.evidence]", error);
    }

    const starRows = evidenceRows.filter((row) => row.use_star);
    const gapRows = starRows.filter(
      (row) => normalizeGapKey(row.gap_key) === parsed.data.gapKey
    );
    const rowsForDraft = gapRows.length ? gapRows : starRows;

    const selectedEvidence = normalizeSelectedEvidence(
      application.selected_evidence
    );
    const fallbackMap = new Map(
      selectedEvidence.map((entry) => [`${entry.signalId}:${entry.id}`, entry])
    );

    const evidenceItems = rowsForDraft
      .map((row) => {
        const item = evidenceBank.byId.get(row.evidence_id);
        if (!item) {
          const fallback = fallbackMap.get(
            `${normalizeGapKey(row.gap_key)}:${row.evidence_id}`
          );
          if (!fallback?.note) {
            return null;
          }
          return {
            evidenceId: row.evidence_id,
            sourceId: row.source_id,
            title: fallback.note,
            text: fallback.note,
            qualityScore: row.quality_score ?? 0,
            hasMetric: false,
          };
        }
        const snippet = buildEvidenceSnippet(item);
        return {
          evidenceId: item.id,
          sourceId: item.sourceId,
          title: item.title,
          text: snippet.shortSnippet,
          qualityScore: item.qualityScore,
          hasMetric: item.qualityFlags.has_metric,
        };
      })
      .filter(Boolean) as Array<{
      evidenceId: string;
      sourceId?: string | null;
      title: string;
      text: string;
      qualityScore: number;
      hasMetric: boolean;
    }>;

    const prefill = buildStarDraftPrefill({
      gapKey: parsed.data.gapKey,
      gapLabel: gapSignal?.label ?? parsed.data.gapKey,
      evidence: evidenceItems,
      profileHeadline: profile?.headline ?? null,
    });

    const title = parsed.data.title?.trim() || prefill.title;
    const evidenceIds = prefill.evidenceIds.filter(isLikelyUuid);

    const saved = await upsertStarLibrary(supabase, user.id, {
      application_id: application.id,
      gap_key: parsed.data.gapKey,
      signal_key: gapSignal?.id ?? null,
      title,
      situation: prefill.situation,
      task: prefill.task,
      action: prefill.action,
      result: prefill.result,
      evidence_ids: evidenceIds,
      quality_hint: prefill.qualityHint,
      updated_at: new Date().toISOString(),
    });

    try {
      await insertAuditLog(supabase, {
        user_id: user.id,
        action: "star_library.create",
        meta: {
          applicationId: application.id,
          gapKey: parsed.data.gapKey,
          evidenceCount: evidenceItems.length,
        },
      });
    } catch (error) {
      console.error("[star-library.audit]", error);
    }

    return NextResponse.json({ draft: saved });
  } catch (error) {
    console.error("[star-library.create]", error);
    return NextResponse.json(
      { error: "Unable to create the STAR draft right now." },
      { status: 500 }
    );
  }
}
