export function getIsoWeekKey(date: Date) {
  const target = new Date(date);
  const dayNr = (target.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const weekNumber = 1 + Math.round(((target.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getDay() + 6) % 7)) / 7);
  return `${target.getFullYear()}-W${String(weekNumber).padStart(2, "0")}`;
}

export function computeStreak(
  weekDoneCounts: Record<string, number>,
  currentWeekKey: string,
  threshold: number
): number {
  let streak = 0;
  let cursor = currentWeekKey;
  while ((weekDoneCounts[cursor] ?? 0) >= threshold) {
    streak += 1;
    cursor = previousIsoWeekKey(cursor);
  }
  return streak;
}

function previousIsoWeekKey(key: string) {
  const match = key.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return key;
  const year = Number(match[1]);
  const week = Number(match[2]);
  const date = isoWeekKeyToDate(year, week);
  date.setDate(date.getDate() - 7);
  return getIsoWeekKey(date);
}

function isoWeekKeyToDate(year: number, week: number) {
  const simple = new Date(year, 0, 1 + (week - 1) * 7);
  const dow = simple.getDay();
  const ISOweekStart = simple;
  if (dow <= 4) {
    ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
  } else {
    ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
  }
  return ISOweekStart;
}

export type WeeklyReviewExampleReason =
  | "status_change"
  | "outcome"
  | "followup"
  | "checklist"
  | "other_activity";

export type WeeklyReviewExample = {
  applicationId: string;
  label: string;
  reason: WeeklyReviewExampleReason;
  href: string;
};

export type WeeklyReviewSummary = {
  applicationsMoved: number;
  followupsSent: number;
  outcomesLogged: number;
  examples: WeeklyReviewExample[];
};

export function buildWeeklyReviewSummary(
  input: {
    activities: Array<{ application_id?: string | null; type?: string | null; occurred_at?: string | null }>;
    outcomes: Array<{ application_id?: string | null; happened_at?: string | null }>;
    apps: Array<{ id: string; job_title?: string | null; company?: string | null; company_name?: string | null; updated_at?: string | null }>;
  },
  weekRange: { start: Date; end: Date }
): WeeklyReviewSummary {
  const activities = input.activities ?? [];
  const outcomes = input.outcomes ?? [];
  const apps = input.apps ?? [];

  const rangeStart = weekRange.start.getTime();
  const rangeEnd = weekRange.end.getTime();

  const reasons: Record<string, WeeklyReviewExampleReason> = {};
  let followupsSent = 0;

  outcomes.forEach((outcome) => {
    const ts = outcome.happened_at ? new Date(outcome.happened_at).getTime() : NaN;
    if (Number.isNaN(ts) || ts < rangeStart || ts >= rangeEnd) return;
    if (outcome.application_id) {
      reasons[outcome.application_id] = "outcome";
    }
  });

  activities.forEach((activity) => {
    const ts = activity.occurred_at ? new Date(activity.occurred_at).getTime() : NaN;
    if (Number.isNaN(ts) || ts < rangeStart || ts >= rangeEnd) return;
    const appId = activity.application_id ?? undefined;
    const type = (activity.type ?? "").toLowerCase();
    const reason = reasonFromActivity(type);
    if (reason === "followup") {
      followupsSent += 1;
    }
    if (!appId) return;
    const current = reasons[appId];
    if (!current || priority(reason) < priority(current)) {
      reasons[appId] = reason;
    }
  });

  apps.forEach((app) => {
    const updatedTs = app.updated_at ? new Date(app.updated_at).getTime() : NaN;
    if (!Number.isNaN(updatedTs) && updatedTs >= rangeStart && updatedTs < rangeEnd) {
      if (!reasons[app.id]) {
        reasons[app.id] = "status_change";
      }
    }
  });

  const examples: WeeklyReviewExample[] = Object.entries(reasons)
    .slice(0, 5)
    .map(([applicationId, reason]) => {
      const app = apps.find((a) => a.id === applicationId);
      const role = app?.job_title ?? "Application";
      const company = app?.company_name ?? app?.company ?? "";
      const label = company ? `${role} · ${company}` : role;
      return {
        applicationId,
        label,
        reason,
        href: buildReasonHref(applicationId, reason),
      };
    });

  return {
    applicationsMoved: Object.keys(reasons).length,
    followupsSent,
    outcomesLogged: countInRange(outcomes.map((o) => o.happened_at), rangeStart, rangeEnd),
    examples,
  };
}

function reasonFromActivity(type: string): WeeklyReviewExampleReason {
  if (type.includes("outcome")) return "outcome";
  if (type.includes("followup") || type.includes("outreach")) return "followup";
  if (type.includes("status") || type.includes("submitted")) return "status_change";
  if (type.includes("checklist") || type.includes("apply") || type.includes("kit")) return "checklist";
  return "other_activity";
}

function priority(reason: WeeklyReviewExampleReason) {
  return ["outcome", "status_change", "followup", "checklist", "other_activity"].indexOf(reason);
}

function buildReasonHref(appId: string, reason: WeeklyReviewExampleReason) {
  if (reason === "followup") return `/app/applications/${appId}?tab=activity#followup`;
  if (reason === "checklist") return `/app/applications/${appId}?tab=apply#smart-apply`;
  if (reason === "status_change") return `/app/applications/${appId}?tab=apply#smart-apply`;
  if (reason === "outcome") return `/app/applications/${appId}?tab=apply#outcomes`;
  return `/app/applications/${appId}?tab=overview`;
}

function countInRange(list: Array<string | null | undefined>, start: number, end: number) {
  return list.reduce((acc, value) => {
    const ts = value ? new Date(value).getTime() : NaN;
    if (Number.isNaN(ts)) return acc;
    if (ts >= start && ts < end) return acc + 1;
    return acc;
  }, 0);
}
