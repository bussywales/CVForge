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

export type WeeklyReviewSummary = {
  applicationsMoved: number;
  followupsSent: number;
  outcomesLogged: number;
};

export function buildWeeklyReviewSummary(input: {
  activities: Array<{ application_id?: string | null; type?: string | null; occurred_at?: string | null }>;
  outcomes: Array<{ application_id?: string | null; happened_at?: string | null }>;
  apps: Array<{ id: string }>;
}, weekRange: { start: Date; end: Date }): WeeklyReviewSummary {
  const activities = input.activities ?? [];
  const outcomes = input.outcomes ?? [];

  const rangeStart = weekRange.start.getTime();
  const rangeEnd = weekRange.end.getTime();

  const movedApps = new Set<string>();
  let followupsSent = 0;
  activities.forEach((activity) => {
    const ts = activity.occurred_at ? new Date(activity.occurred_at).getTime() : NaN;
    if (Number.isNaN(ts) || ts < rangeStart || ts >= rangeEnd) return;
    if (activity.application_id) {
      movedApps.add(activity.application_id);
    }
    const type = activity.type ?? "";
    if (type.includes("followup") || type.includes("outreach")) {
      followupsSent += 1;
    }
  });

  let outcomesLogged = 0;
  outcomes.forEach((outcome) => {
    const ts = outcome.happened_at ? new Date(outcome.happened_at).getTime() : NaN;
    if (Number.isNaN(ts) || ts < rangeStart || ts >= rangeEnd) return;
    outcomesLogged += 1;
    if (outcome.application_id) {
      movedApps.add(outcome.application_id);
    }
  });

  return {
    applicationsMoved: movedApps.size,
    followupsSent,
    outcomesLogged,
  };
}
