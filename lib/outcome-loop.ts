import type { SupabaseClient } from "@supabase/supabase-js";

export const OUTCOME_STATUSES = [
  "draft",
  "submitted",
  "no_response",
  "rejected",
  "interview_scheduled",
  "interview_completed",
  "offer",
  "accepted",
  "withdrawn",
] as const;

export const OUTCOME_REASON_CODES = [
  "salary_mismatch",
  "location",
  "skills_gap",
  "timing",
  "unknown",
  "internal_candidate",
  "other",
] as const;

export type ActionSummary = {
  evidence_selected: number;
  outreach_logged: number;
  practice_answers: number;
  answer_pack_generated: number;
  kit_downloaded: number;
  exports: number;
  followups_logged: number;
};

export async function computeActionSummaryForApplication(
  supabase: SupabaseClient,
  userId: string,
  applicationId: string
): Promise<ActionSummary> {
  const summary: ActionSummary = {
    evidence_selected: 0,
    outreach_logged: 0,
    practice_answers: 0,
    answer_pack_generated: 0,
    kit_downloaded: 0,
    exports: 0,
    followups_logged: 0,
  };

  const countQuery = async (table: string, match: Record<string, string>) => {
    const { count, error } = await supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .match(match);
    if (error) {
      console.error("[outcome.summary]", table, error);
      return 0;
    }
    return count ?? 0;
  };

  summary.evidence_selected = await countQuery("application_evidence", {
    user_id: userId,
    application_id: applicationId,
  });

  summary.outreach_logged = await countQuery("application_activities", {
    user_id: userId,
    application_id: applicationId,
    type: "outreach",
  });

  summary.practice_answers = await countQuery("interview_practice_answers", {
    user_id: userId,
    application_id: applicationId,
  });

  summary.answer_pack_generated = await countQuery("interview_answer_pack", {
    user_id: userId,
    application_id: applicationId,
  });

  summary.kit_downloaded = await countQuery("application_activities", {
    user_id: userId,
    application_id: applicationId,
    type: "kit.download",
  });

  summary.exports = await countQuery("application_activities", {
    user_id: userId,
    application_id: applicationId,
    type: "export",
  });

  summary.followups_logged = await countQuery("application_activities", {
    user_id: userId,
    application_id: applicationId,
    type: "followup",
  });

  return summary;
}

export type OutcomeInsight = {
  text: string;
};

export function buildOutcomeInsights(
  outcomes: Array<{ outcome_status: string }>,
  actions: Array<{ action_key: string; action_count: number }>
): OutcomeInsight[] {
  const insights: OutcomeInsight[] = [];
  const interviewOutcomes = outcomes.filter((o) =>
    ["interview_scheduled", "interview_completed", "offer", "accepted"].includes(
      o.outcome_status
    )
  );
  const submittedOutcomes = outcomes.filter((o) =>
    ["submitted", "no_response", "rejected"].includes(o.outcome_status)
  );

  const addInsight = (text: string) => {
    insights.push({ text });
  };

  if (submittedOutcomes.length >= 3) {
    addInsight(
      `Submitted applications recorded: ${submittedOutcomes.length}.`
    );
  } else {
    addInsight("Not enough outcome data yet to spot patterns.");
  }

  if (interviewOutcomes.length >= 3) {
    const evidenceCount = actions
      .filter((a) => a.action_key === "evidence_selected")
      .reduce((acc, a) => acc + a.action_count, 0);
    if (evidenceCount > 0) {
      addInsight(
        "Interviews correlate with selecting evidence for gaps (evidence present in interview outcomes)."
      );
    }
    const outreachCount = actions
      .filter(
        (a) =>
          a.action_key === "outreach_logged" ||
          a.action_key === "followups_logged"
      )
      .reduce((acc, a) => acc + a.action_count, 0);
    if (outreachCount > 0) {
      addInsight("Interview outcomes often had outreach/follow-ups logged.");
    }
  }

  return insights;
}

export function buildOutcomeInsightsV2(
  outcomes: Array<{ outcome_status: string; outcome_reason?: string | null; happened_at?: string | null }>
) {
  const recent = outcomes.slice(0, 20);
  const reasons = recent
    .map((o) => o.outcome_reason)
    .filter(Boolean) as string[];
  const reasonCounts = reasons.reduce<Record<string, number>>((acc, reason) => {
    acc[reason] = (acc[reason] ?? 0) + 1;
    return acc;
  }, {});
  const topReasons = Object.entries(reasonCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([reason, count]) => `${reason.replace("_", " ")} (${count})`);

  const last = recent[0];
  const recommendations: Array<{ label: string; href: string }> = [];
  if (last?.outcome_status === "rejected") {
    recommendations.push({
      label: "Strengthen evidence",
      href: "#role-fit",
    });
  }
  if (last?.outcome_status === "no_response") {
    recommendations.push({
      label: "Send follow-up",
      href: "#outreach",
    });
  }
  if (last?.outcome_status === "interview_scheduled") {
    recommendations.push({
      label: "Prep interview",
      href: "#interview-pack",
    });
  }
  if (last?.outcome_status === "offer") {
    recommendations.push({
      label: "Log offer outcome",
      href: "#outcome-loop",
    });
  }

  const bullets = topReasons.length
    ? [`Top reasons: ${topReasons.join(", ")}`]
    : ["Not enough outcomes yet to spot patterns."];

  return { bullets, recommendations };
}
