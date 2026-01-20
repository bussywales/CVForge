import type { ApplicationRecord } from "@/lib/data/applications";
import type { InsightSummary } from "@/lib/insights";

export type KeepMomentumAction = {
  title: string;
  reason: string;
  ctaLabel: string;
  href: string;
  kind: "followup" | "outcome" | "interview" | "evidence" | "pipeline";
  ruleId: string;
  applicationId?: string | null;
};

export type KeepMomentumModel = {
  status: "ready" | "not_ready" | "complete" | "skipped";
  primary: KeepMomentumAction | null;
  secondary?: KeepMomentumAction | null;
  meta: {
    chosenRule: string | null;
    signals: Record<string, any>;
    targetAppId?: string | null;
  };
};

type Input = {
  applications: ApplicationRecord[];
  insights?: InsightSummary | null;
  skip?: boolean;
};

function isArchived(app: ApplicationRecord) {
  return (app.status ?? "").toString().toLowerCase() === "archived";
}

function pickNewest(apps: ApplicationRecord[]): ApplicationRecord | null {
  if (apps.length === 0) return null;
  const sorted = [...apps].sort((a, b) => {
    const aDate = a.last_activity_at ?? a.updated_at ?? a.created_at;
    const bDate = b.last_activity_at ?? b.updated_at ?? b.created_at;
    return (bDate ?? "").localeCompare(aDate ?? "");
  });
  return sorted[0];
}

function hasUpcomingFollowup(app: ApplicationRecord, today: Date) {
  const candidates = [app.next_action_due, app.outreach_next_due_at, app.next_followup_at];
  return candidates.some((date) => {
    if (!date) return false;
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return false;
    return parsed >= today;
  });
}

function hasRecentOutcome(app: ApplicationRecord, today: Date) {
  const fields = [app.last_outcome_at, app.outcome_at];
  return fields.some((date) => {
    if (!date) return false;
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return false;
    const diffDays = (today.getTime() - parsed.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays <= 14;
  });
}

function hasInterviewSignal(insights?: InsightSummary | null) {
  if (!insights?.activities) return false;
  return insights.activities.some((activity) => (activity.type ?? "").includes("interview"));
}

function hasEvidence(app: ApplicationRecord) {
  if (!app.selected_evidence) return false;
  if (Array.isArray(app.selected_evidence)) return app.selected_evidence.length > 0;
  if (typeof app.selected_evidence === "object") return Object.keys(app.selected_evidence as any).length > 0;
  return false;
}

export function buildKeepMomentumModel(input: Input): KeepMomentumModel {
  if (input.skip) {
    return { status: "skipped", primary: null, meta: { chosenRule: null, signals: {} } };
  }

  const today = new Date();
  const activeApps = input.applications.filter((app) => !isArchived(app));
  const newest = pickNewest(activeApps);

  const signals = {
    activeApps: activeApps.length,
    hasUpcomingFollowup: newest ? hasUpcomingFollowup(newest, today) : false,
    hasRecentOutcome: newest ? hasRecentOutcome(newest, today) : false,
    interviewSignal: hasInterviewSignal(input.insights),
    evidenceMissing: newest ? !hasEvidence(newest) : true,
  };

  if (!newest) {
    return {
      status: "not_ready",
      primary: null,
      meta: { chosenRule: null, signals, targetAppId: null },
    };
  }

  const rules: { id: string; match: boolean; build: () => KeepMomentumAction }[] = [
    {
      id: "followup_gap",
      match: activeApps.length > 0 && !activeApps.some((app) => hasUpcomingFollowup(app, today)),
      build: () => ({
        title: "Schedule a follow-up",
        reason: "No follow-ups queued — set the next touchpoint.",
        ctaLabel: "Schedule",
        href: `/app/applications/${newest.id}?tab=activity#outreach`,
        kind: "followup",
        ruleId: "followup_gap",
        applicationId: newest.id,
      }),
    },
    {
      id: "outcome_gap",
      match: activeApps.length > 0 && !activeApps.some((app) => hasRecentOutcome(app, today)),
      build: () => ({
        title: "Log an outcome",
        reason: "No recent outcomes logged — keep insights fresh.",
        ctaLabel: "Log outcome",
        href: `/app/applications/${newest.id}?tab=overview#outcome`,
        kind: "outcome",
        ruleId: "outcome_gap",
        applicationId: newest.id,
      }),
    },
    {
      id: "interview_prep",
      match: hasInterviewSignal(input.insights),
      build: () => ({
        title: "Practise weakest questions",
        reason: "You have interview signals — rehearse now.",
        ctaLabel: "Open practice",
        href: `/app/applications/${newest.id}?tab=interview#practice-dashboard`,
        kind: "interview",
        ruleId: "interview_prep",
        applicationId: newest.id,
      }),
    },
    {
      id: "evidence_gap",
      match: activeApps.some((app) => !hasEvidence(app)),
      build: () => {
        const target = activeApps.find((app) => !hasEvidence(app)) ?? newest;
        return {
          title: "Add evidence for gaps",
          reason: "Evidence lifts your next submission.",
          ctaLabel: "Add evidence",
          href: `/app/applications/${target.id}?tab=evidence#role-fit`,
          kind: "evidence",
          ruleId: "evidence_gap",
          applicationId: target.id,
        };
      },
    },
  ];

  const matched = rules.find((rule) => rule.match);

  if (matched) {
    const primary = matched.build();
    const secondary: KeepMomentumAction | null = {
      title: "Review active applications",
      reason: "Check pipeline if now isn’t right.",
      ctaLabel: "Open pipeline",
      href: "/app/applications",
      kind: "pipeline",
      ruleId: `${matched.id}_secondary`,
    };

    return {
      status: "ready",
      primary,
      secondary,
      meta: { chosenRule: matched.id, signals, targetAppId: primary.applicationId ?? null },
    };
  }

  const fallback: KeepMomentumAction = {
    title: "Review active applications",
    reason: "Small steps compound.",
    ctaLabel: "Open pipeline",
    href: "/app/applications",
    kind: "pipeline",
    ruleId: "fallback_pipeline",
  };

  return {
    status: "complete",
    primary: fallback,
    meta: { chosenRule: "fallback_pipeline", signals, targetAppId: newest.id },
  };
}
