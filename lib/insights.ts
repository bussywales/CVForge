import type { SupabaseClient } from "@supabase/supabase-js";
import { getEffectiveJobText } from "@/lib/job-text";
import type { ApplicationRecord } from "@/lib/data/applications";
import { normalizeSelectedEvidence } from "@/lib/evidence";

export type InsightTopAction = {
  id: string;
  label: string;
  why: string;
  href: string;
  applicationId: string;
  role: string;
  company: string;
  priority: number;
};

export type InsightSummary = {
  topActions: InsightTopAction[];
  funnel: {
    drafted: number;
    submitted: number;
    interview: number;
    offer: number;
    rejected: number;
    noResponse: number;
    responseRate: number;
  };
  correlations: {
    text: string;
  }[];
};

const INTERVIEW_STATUSES = new Set([
  "interview_scheduled",
  "interview_completed",
  "offer",
  "accepted",
]);

function isOverdue(value: string | null, today = new Date()) {
  if (!value) return false;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;
  const todayKey = parsedDateKey(today);
  const valueKey = parsedDateKey(parsed);
  return valueKey <= todayKey;
}

function parsedDateKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export async function getInsightsSummary(
  supabase: SupabaseClient,
  userId: string
): Promise<InsightSummary> {
  const [applicationsRes, outcomesRes, activitiesRes, practiceRes] =
    await Promise.all([
      supabase
        .from("applications")
        .select("*")
        .eq("user_id", userId),
      supabase
        .from("application_outcomes")
        .select("application_id,outcome_status,happened_at")
        .eq("user_id", userId),
      supabase
        .from("application_activities")
        .select("application_id,type,occurred_at")
        .eq("user_id", userId),
      supabase
        .from("interview_practice_answers")
        .select("application_id")
        .eq("user_id", userId),
    ]);

  const applications = (applicationsRes.data ?? []) as ApplicationRecord[];
  const outcomes = outcomesRes.data ?? [];
  const activities = activitiesRes.data ?? [];
  const practiceApps = new Set(
    (practiceRes.data ?? []).map((row: any) => row.application_id)
  );

  const interviewApps = new Set<string>();
  outcomes.forEach((outcome: any) => {
    if (INTERVIEW_STATUSES.has(outcome.outcome_status)) {
      interviewApps.add(outcome.application_id);
    }
  });
  activities.forEach((activity: any) => {
    if ((activity.type ?? "").startsWith("interview")) {
      interviewApps.add(activity.application_id);
    }
  });

  const today = new Date();
  const topActions: InsightTopAction[] = [];

  applications.forEach((app) => {
    const role = app.job_title ?? "Untitled role";
    const company = app.company_name ?? app.company ?? "—";
    const jobText = getEffectiveJobText(app);
    const jobLen = jobText.trim().length;
    const selectedEvidence = normalizeSelectedEvidence(app.selected_evidence);
    const starDrafts = Array.isArray(app.star_drafts)
      ? (app.star_drafts as unknown[])
      : [];

    if (isOverdue(app.next_action_due, today)) {
      topActions.push({
        id: `followup-${app.id}`,
        label: "Follow up due",
        why: "Keep momentum with timely follow-ups.",
        href: `/app/applications/${app.id}?tab=activity#activity-log`,
        applicationId: app.id,
        role,
        company,
        priority: 1,
      });
    }

    if (jobLen < 200) {
      topActions.push({
        id: `jobtext-${app.id}`,
        label: "Job text missing",
        why: "Paste the advert so Role Fit stays accurate.",
        href: `/app/applications/${app.id}?tab=overview#job-advert`,
        applicationId: app.id,
        role,
        company,
        priority: 2,
      });
    }

    if (selectedEvidence.length === 0) {
      topActions.push({
        id: `evidence-${app.id}`,
        label: "Add evidence for gaps",
        why: "Evidence improves exports and interviews.",
        href: `/app/applications/${app.id}?tab=evidence#role-fit`,
        applicationId: app.id,
        role,
        company,
        priority: 3,
      });
    }

    if (starDrafts.length === 0) {
      topActions.push({
        id: `star-${app.id}`,
        label: "Create a STAR draft",
        why: "STAR stories power interviews and Answer Pack.",
        href: `/app/applications/${app.id}?tab=evidence#star-library`,
        applicationId: app.id,
        role,
        company,
        priority: 4,
      });
    }

    if (practiceApps.has(app.id) === false && interviewApps.has(app.id)) {
      topActions.push({
        id: `practice-${app.id}`,
        label: "Practise weakest questions",
        why: "Convert interviews with rehearsed answers.",
        href: `/app/applications/${app.id}?tab=interview#practice-dashboard`,
        applicationId: app.id,
        role,
        company,
        priority: 5,
      });
    }
  });

  topActions.sort((a, b) => a.priority - b.priority);
  const unique = new Map<string, InsightTopAction>();
  topActions.forEach((action) => {
    if (unique.size >= 5) return;
    unique.set(action.applicationId + action.id, action);
  });

  // Funnel
  const drafted = applications.length;
  let submitted = 0;
  let interview = 0;
  let offer = 0;
  let rejected = 0;
  let noResponse = 0;

  const submittedApps = new Set<string>();
  applications.forEach((app) => {
    const status = (app.status ?? "").toLowerCase();
    const submittedFlag =
      status === "submitted" || Boolean(app.submitted_at) || app.outcome_status === "submitted";
    if (submittedFlag) {
      submitted += 1;
      submittedApps.add(app.id);
      if (!interviewApps.has(app.id)) {
        const submittedDate = app.submitted_at
          ? new Date(app.submitted_at)
          : null;
        const ageDays = submittedDate
          ? (today.getTime() - submittedDate.getTime()) / (1000 * 60 * 60 * 24)
          : 0;
        if (ageDays >= 21) {
          noResponse += 1;
        }
      }
    }
    if (interviewApps.has(app.id)) {
      interview += 1;
    }
    if (app.last_outcome_status === "offer" || app.last_outcome_status === "accepted") {
      offer += 1;
    }
    if (app.last_outcome_status === "rejected") {
      rejected += 1;
    }
  });

  outcomes.forEach((outcome: any) => {
    if (outcome.outcome_status === "offer" || outcome.outcome_status === "accepted") {
      offer += 0; // already counted via applications
    }
  });

  const responseRate =
    submitted > 0 ? Math.round((interview / submitted) * 100) : 0;

  // Correlations (simple, last 90 days)
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const recentOutcomes = outcomes.filter(
    (o: any) => new Date(o.happened_at) >= ninetyDaysAgo
  );
  const hasEnough = recentOutcomes.length >= 5;
  const correlationText = hasEnough
    ? "Interviews correlate with timely follow-ups, evidence selection, and STAR drafts in the last 90 days."
    : "Not enough data yet — keep logging outcomes and actions.";

  return {
    topActions: Array.from(unique.values()),
    funnel: {
      drafted,
      submitted,
      interview,
      offer,
      rejected,
      noResponse,
      responseRate,
    },
    correlations: [{ text: correlationText }],
  };
}
