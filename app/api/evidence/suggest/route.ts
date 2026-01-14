import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import { fetchApplication } from "@/lib/data/applications";
import { listAchievements } from "@/lib/data/achievements";
import { listWorkHistory } from "@/lib/data/work-history";
import { fetchProfile } from "@/lib/data/profile";
import { listActiveDomainPacks } from "@/lib/data/domain-packs";
import {
  getSelectedEvidenceForApplication,
  type SelectedEvidenceByGap,
} from "@/lib/data/application-evidence";
import {
  buildEvidenceBank,
  buildEvidenceSnippet,
  markSelectedSuggestions,
  normalizeSelectedEvidence,
  rankEvidenceForGap,
} from "@/lib/evidence";
import { getEffectiveJobText } from "@/lib/job-text";
import { inferDomainGuess } from "@/lib/jd-learning";
import type { RoleFitPack } from "@/lib/role-fit";
import { buildRoleFitSignals, calculateRoleFit, detectRoleFitPacks } from "@/lib/role-fit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const payloadSchema = z.object({
  applicationId: z.string().uuid(),
});

async function handleSuggest(applicationId: string) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const application = await fetchApplication(
      supabase,
      user.id,
      applicationId
    );

    if (!application) {
      return NextResponse.json(
        { error: "Application not found." },
        { status: 404 }
      );
    }

    const [profile, achievements, workHistory, selectedEvidenceByGap] =
      await Promise.all([
        fetchProfile(supabase, user.id),
        listAchievements(supabase, user.id),
        listWorkHistory(supabase, user.id),
        getSelectedEvidenceForApplication(supabase, user.id, application.id),
      ]);
    const selectedEvidenceNotes = normalizeSelectedEvidence(
      application.selected_evidence
    ).reduce((map, entry) => {
      map.set(`${entry.signalId}:${entry.id}`, entry);
      return map;
    }, new Map<string, ReturnType<typeof normalizeSelectedEvidence>[number]>());

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
      profileLocation: profile?.location,
      achievements,
      workHistory,
      signals,
    });

    const gaps = roleFit.gapSignals.map((gap) => {
      const selectedForGap = selectedEvidenceByGap[gap.id] ?? [];
      const selectedEvidenceSet = new Set(
        selectedForGap.map((row) => row.evidence_id)
      );
      const baseSuggestions = rankEvidenceForGap(gap.id, evidenceBank).map(
        ({ item, matchScore, qualityScore }) => {
          const snippet = buildEvidenceSnippet(item);
          return {
            id: item.id,
            kind: item.kind,
            title: item.title,
            text: item.text,
            shortSnippet: snippet.shortSnippet,
            matchScore,
            qualityScore,
            sourceType: item.sourceType,
            sourceId: item.sourceId,
          };
        }
      );
      const suggestions = markSelectedSuggestions(
        baseSuggestions,
        selectedEvidenceSet
      );

      const selectedEvidence = buildSelectedEvidenceList(
        gap.id,
        selectedForGap,
        evidenceBank,
        selectedEvidenceNotes
      );

      return {
        signalId: gap.id,
        label: gap.label,
        suggestedEvidence: suggestions,
        selectedEvidence,
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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const applicationId = searchParams.get("applicationId") ?? "";
  const parsed = payloadSchema.safeParse({ applicationId });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  return handleSuggest(parsed.data.applicationId);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = payloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  return handleSuggest(parsed.data.applicationId);
}

type SelectedEvidenceNote = ReturnType<typeof normalizeSelectedEvidence>[number];

function buildSelectedEvidenceList(
  gapKey: string,
  selectedRows: SelectedEvidenceByGap[string],
  evidenceBank: ReturnType<typeof buildEvidenceBank>,
  noteMap: Map<string, SelectedEvidenceNote>
) {
  return selectedRows
    .map((row) => {
      const evidenceItem = evidenceBank.byId.get(row.evidence_id);
      if (evidenceItem) {
        const snippet = buildEvidenceSnippet(evidenceItem);
        return {
          id: evidenceItem.id,
          kind: evidenceItem.kind,
          title: evidenceItem.title,
          text: evidenceItem.text,
          shortSnippet: snippet.shortSnippet,
          qualityScore: evidenceItem.qualityScore,
        };
      }
      const fallback = noteMap.get(`${gapKey}:${row.evidence_id}`);
      if (!fallback) {
        return null;
      }
      return {
        id: fallback.id,
        kind: fallback.kind,
        title: fallback.note ? fallback.note : "Selected evidence",
        text: fallback.note ?? "",
        shortSnippet: fallback.note ?? "",
        qualityScore: row.quality_score ?? 0,
      };
    })
    .filter(Boolean);
}
