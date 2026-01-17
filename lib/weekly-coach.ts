export type WeeklyCoachActionType =
  | "followup"
  | "jobtext"
  | "evidence"
  | "star"
  | "autopack"
  | "interview_pack"
  | "answer_pack"
  | "outcome"
  | "billing";

export type WeeklyCoachAction = {
  type: WeeklyCoachActionType;
  priority: number;
  title: string;
  why: string;
  href: string;
  appId?: string;
};

export type WeeklyCoachSignals = {
  activeApps: Array<{
    id: string;
    company?: string | null;
    role?: string | null;
    nextActionDue?: string | null;
    hasJobText?: boolean;
    hasEvidenceSelected?: boolean;
    hasStarDraft?: boolean;
    hasAutopack?: boolean;
    hasAnswerPack?: boolean;
    hasInterviewPack?: boolean;
  }>;
  isSubscribed?: boolean;
  hasCredits?: boolean;
};

export type WeeklyCoachPlan = {
  weekLabel: string;
  headline: string;
  targets: { followUps: number; practice: number; applications: number };
  actions: WeeklyCoachAction[];
};

const RANKING: Record<WeeklyCoachActionType, number> = {
  followup: 1,
  jobtext: 2,
  evidence: 3,
  star: 4,
  autopack: 5,
  billing: 5,
  answer_pack: 6,
  interview_pack: 7,
  outcome: 8,
};

export function buildWeeklyCoachPlan(
  signals: WeeklyCoachSignals,
  now = new Date()
): WeeklyCoachPlan {
  const { start, end } = currentWeekRange(now);
  const weekLabel = formatWeekLabel(start, end);
  const actions = selectActions(signals, now);
  const targets = computeTargets(signals.activeApps?.length ?? 0);

  return {
    weekLabel,
    headline: "3 quick steps to move applications forward this week",
    targets,
    actions,
  };
}

function selectActions(signals: WeeklyCoachSignals, now: Date): WeeklyCoachAction[] {
  const candidates: WeeklyCoachAction[] = [];
  const activeApps = signals.activeApps ?? [];

  activeApps.forEach((app, appIndex) => {
    const role = app.role?.trim() || "this role";
    const company = app.company?.trim() || "";
    const label = company ? `${role} · ${company}` : role;
    const baseHref = `/app/applications/${app.id}`;
    const autopackHref = `${baseHref}?tab=apply#autopacks`;
    const priorityBump = appIndex;

    if (isDueTodayOrPast(app.nextActionDue, now)) {
      candidates.push({
        type: "followup",
        priority: RANKING.followup * 10 + priorityBump,
        title: `Follow up on ${label}`,
        why: "Due or overdue follow-up.",
        href: `${baseHref}?tab=activity#followup`,
        appId: app.id,
      });
    }

    if (!app.hasJobText) {
      candidates.push({
        type: "jobtext",
        priority: RANKING.jobtext * 10 + priorityBump,
        title: `Paste the job advert for ${label}`,
        why: "Keeps Role Fit accurate.",
        href: `${baseHref}?tab=overview#job-advert`,
        appId: app.id,
      });
    }

    if (!app.hasEvidenceSelected) {
      candidates.push({
        type: "evidence",
        priority: RANKING.evidence * 10 + priorityBump,
        title: `Select evidence for ${label}`,
        why: "Evidence powers exports and interviews.",
        href: `${baseHref}?tab=evidence#role-fit`,
        appId: app.id,
      });
    }

    if (!app.hasStarDraft) {
      candidates.push({
        type: "star",
        priority: RANKING.star * 10 + priorityBump,
        title: `Draft a STAR story for ${label}`,
        why: "STAR stories unlock interviews.",
        href: `${baseHref}?tab=evidence#star-library`,
        appId: app.id,
      });
    }

    if (!app.hasAutopack) {
      if (signals.hasCredits || signals.isSubscribed) {
        candidates.push({
          type: "autopack",
          priority: RANKING.autopack * 10 + priorityBump,
          title: `Generate an Autopack for ${label}`,
          why: "Submit faster with a ready-made pack.",
          href: autopackHref,
          appId: app.id,
        });
      } else {
        candidates.push({
          type: "billing",
          priority: RANKING.billing * 10 + priorityBump,
          title: `Unlock Autopacks for ${label}`,
          why: "No credits left for Autopacks.",
          href: `/app/billing?returnTo=${encodeURIComponent(autopackHref)}`,
          appId: app.id,
        });
      }
    }

    if (!app.hasAnswerPack) {
      candidates.push({
        type: "answer_pack",
        priority: RANKING.answer_pack * 10 + priorityBump,
        title: `Prep interview answers for ${label}`,
        why: "Answer Pack improves conversion.",
        href: `${baseHref}?tab=interview#answer-pack`,
        appId: app.id,
      });
    }
  });

  const ordered = candidates.sort((a, b) => a.priority - b.priority);
  const filtered: WeeklyCoachAction[] = [];
  const counts: Partial<Record<WeeklyCoachActionType, number>> = {};

  for (const action of ordered) {
    const count = counts[action.type] ?? 0;
    if (count >= 2) continue;
    counts[action.type] = count + 1;
    filtered.push(action);
    if (filtered.length >= 5) break;
  }

  if (filtered.length === 0) {
    return fallbackActions();
  }

  if (filtered.length < 3) {
    for (const action of fallbackActions()) {
      if (filtered.length >= 3) break;
      const count = counts[action.type] ?? 0;
      if (count >= 2) continue;
      counts[action.type] = count + 1;
      filtered.push(action);
    }
  }

  return filtered;
}

function currentWeekRange(now: Date) {
  const start = new Date(now);
  const day = start.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + diff);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

function formatWeekLabel(start: Date, end: Date) {
  const fmt = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" });
  return `${fmt.format(start)} – ${fmt.format(end)}`;
}

function isDueTodayOrPast(value?: string | null, now = new Date()) {
  if (!value) return false;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;
  const todayKey = dateKey(now);
  const dueKey = dateKey(parsed);
  return dueKey <= todayKey;
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function computeTargets(activeAppCount: number) {
  const followUps = clamp(activeAppCount * 2, 4, 10);
  const practice = clamp(Math.ceil(activeAppCount / 2), 2, 6);
  const applications = clamp(Math.ceil(activeAppCount / 3), 1, 4);
  return { followUps, practice, applications };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function fallbackActions(): WeeklyCoachAction[] {
  return [
    {
      type: "outcome",
      priority: 99,
      title: "Review your queue",
      why: "Check for any roles that need attention.",
      href: "/app/applications",
    },
    {
      type: "followup",
      priority: 99,
      title: "Set follow-ups",
      why: "Schedule next steps to stay on track.",
      href: "/app/applications",
    },
  ];
}
