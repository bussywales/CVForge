import type { SupabaseClient } from "@supabase/supabase-js";
import { insertAuditLog } from "@/lib/data/audit-log";
import type { ApplicationRecord } from "@/lib/data/applications";
import type { RoleFitResult } from "@/lib/role-fit";
import { createServiceRoleClient } from "@/lib/supabase/service";
import {
  buildPackProposal,
  extractTopTerms,
  inferDomainGuess,
} from "@/lib/jd-learning";

type LearningParams = {
  supabase: SupabaseClient;
  userId: string;
  application: ApplicationRecord;
  roleFit: RoleFitResult;
  telemetryOptIn: boolean;
};

export async function logLearningEvent({
  supabase,
  userId,
  application,
  roleFit,
  telemetryOptIn,
}: LearningParams) {
  if (!telemetryOptIn) {
    return;
  }

  const jobDescription = application.job_description ?? "";
  if (!jobDescription.trim()) {
    return;
  }

  const domainGuess = inferDomainGuess(
    application.job_title ?? "",
    jobDescription
  );
  const topTerms = extractTopTerms(jobDescription);
  const matchedSignals = roleFit.matchedSignals.map((signal) =>
    `${signal.packId}:${signal.id}`
  );
  const missingSignals = roleFit.gapSignals.map((signal) =>
    `${signal.packId}:${signal.id}`
  );

  try {
    const { error } = await supabase.from("role_fit_learning_events").insert({
      user_id: userId,
      application_id: application.id,
      job_title: application.job_title,
      job_url: application.job_url,
      domain_guess: domainGuess,
      jd_length: jobDescription.length,
      matched_signals: matchedSignals,
      missing_signals: missingSignals,
      top_terms: topTerms,
    });

    if (error && error.code !== "23505") {
      throw error;
    }
  } catch (error) {
    console.error("[learning.events]", error);
  }

  try {
    await upsertPackProposal({
      userId,
      domainGuess,
      sourceTerms: topTerms,
    });
  } catch (error) {
    console.error("[learning.proposals]", error);
  }

  try {
    await insertAuditLog(supabase, {
      user_id: userId,
      action: "learning.jd.logged",
      meta: {
        topTermsCount: topTerms.length,
        matchedSignalsCount: matchedSignals.length,
        missingSignalsCount: missingSignals.length,
      },
    });
  } catch (error) {
    console.error("[learning.audit]", error);
  }
}

type ProposalParams = {
  userId: string;
  domainGuess: string;
  sourceTerms: string[];
};

async function upsertPackProposal({
  userId,
  domainGuess,
  sourceTerms,
}: ProposalParams) {
  const service = createServiceRoleClient();
  const proposal = buildPackProposal(sourceTerms, domainGuess);

  const { data: existing, error } = await service
    .from("domain_pack_proposals")
    .select("id, occurrences, source_terms, signals, status")
    .eq("domain_guess", domainGuess)
    .eq("status", "pending");

  if (error) {
    throw error;
  }

  const match = (existing ?? []).find((row) =>
    hasOverlap(row.source_terms as string[], sourceTerms)
  );

  if (match) {
    const mergedTerms = mergeTerms(match.source_terms as string[], sourceTerms);
    const mergedSignals = mergeSignals(
      (match.signals as unknown[]) ?? [],
      proposal.signals
    );

    const { error: updateError } = await service
      .from("domain_pack_proposals")
      .update({
        occurrences: (match.occurrences ?? 1) + 1,
        source_terms: mergedTerms,
        signals: mergedSignals,
        updated_at: new Date().toISOString(),
      })
      .eq("id", match.id);

    if (updateError) {
      throw updateError;
    }

    return;
  }

  const { error: insertError } = await service
    .from("domain_pack_proposals")
    .insert({
      created_by: userId,
      domain_guess: domainGuess,
      title: proposal.title,
      signals: proposal.signals,
      source_terms: sourceTerms,
      occurrences: 1,
      status: "pending",
    });

  if (insertError) {
    throw insertError;
  }
}

function hasOverlap(existing: string[], incoming: string[]) {
  const existingSet = new Set(existing);
  const overlap = incoming.filter((term) => existingSet.has(term));
  return overlap.length >= 3;
}

function mergeTerms(existing: string[], incoming: string[]) {
  return Array.from(new Set([...existing, ...incoming])).slice(0, 50);
}

type Signal = {
  id: string;
  label: string;
  weight: number;
  aliases: string[];
  gapSuggestions: string[];
  metricSnippets: string[];
};

function mergeSignals(existing: unknown[], incoming: Signal[]) {
  const byId = new Map<string, Signal>();
  existing.forEach((signal) => {
    if (!signal || typeof signal !== "object") {
      return;
    }
    const s = signal as Signal;
    if (s.id) {
      byId.set(s.id, s);
    }
  });

  incoming.forEach((signal) => {
    if (!byId.has(signal.id)) {
      byId.set(signal.id, signal);
    }
  });

  return Array.from(byId.values());
}
