import { addBusinessDays } from "@/lib/tracking-utils";

export type WeeklyTargets = {
  followups: { current: number; target: number; hint: string };
  submissions: { current: number; target: number; hint: string };
  starDrafts: { current: number; target: number; hint: string };
  practice: { current: number; target: number; hint: string } | null;
};

export type WeakestStep = {
  id: string;
  title: string;
  detail: string;
  href: string;
};

export type CoachAction = {
  id: string;
  label: string;
  href: string;
};

export function getWeekRange(now = new Date()) {
  const start = new Date(now);
  const day = start.getDay(); // 0=Sun
  const diff = (day === 0 ? -6 : 1) - day; // move to Monday
  start.setDate(start.getDate() + diff);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return { start, end };
}

export function computeWeeklyTargets(input: {
  followups: number;
  submissions: number;
  starDrafts: number;
  practice?: number | null;
}): WeeklyTargets {
  return {
    followups: {
      current: input.followups,
      target: 3,
      hint: "Log at least 3 follow-ups this week.",
    },
    submissions: {
      current: input.submissions,
      target: 2,
      hint: "Aim for 2 quality submissions.",
    },
    starDrafts: {
      current: input.starDrafts,
      target: 2,
      hint: "Create 2 STAR drafts for top gaps.",
    },
    practice: input.practice == null ? null : {
      current: input.practice,
      target: 2,
      hint: "Complete 2 drill sessions.",
    },
  };
}

export function detectWeakestStep(input: {
  overdueFollowups: number;
  missingJobDetails: number;
  lowEvidence: number;
  missingStar: number;
  firstOverdueApp?: string | null;
  firstMissingJobApp?: string | null;
  firstEvidenceApp?: string | null;
  firstStarApp?: string | null;
}): WeakestStep {
  if (input.overdueFollowups > 0) {
    return {
      id: "followup",
      title: "Weakest step: Follow-up cadence",
      detail: `${input.overdueFollowups} applications are due/overdue for follow-up.`,
      href: input.firstOverdueApp
        ? `/app/applications/${input.firstOverdueApp}?tab=activity#follow-up`
        : "/app/pipeline",
    };
  }
  if (input.missingJobDetails > 0) {
    return {
      id: "jobtext",
      title: "Weakest step: Job details missing",
      detail: `${input.missingJobDetails} applications need pasted job text.`,
      href: input.firstMissingJobApp
        ? `/app/applications/${input.firstMissingJobApp}?tab=overview#job-advert`
        : "/app/applications",
    };
  }
  if (input.lowEvidence > 0) {
    return {
      id: "evidence",
      title: "Weakest step: Evidence gaps",
      detail: "Add evidence for top gaps to improve exports.",
      href: input.firstEvidenceApp
        ? `/app/applications/${input.firstEvidenceApp}?tab=evidence#role-fit`
        : "/app/applications",
    };
  }
  if (input.missingStar > 0) {
    return {
      id: "star",
      title: "Weakest step: STAR stories missing",
      detail: "Create a STAR draft for a priority gap.",
      href: input.firstStarApp
        ? `/app/applications/${input.firstStarApp}?tab=evidence#star-library`
        : "/app/applications",
    };
  }
  return {
    id: "on-track",
    title: "You’re on track",
    detail: "Keep momentum with submissions and follow-ups.",
    href: "/app/pipeline",
  };
}

export function pickCoachActions(input: {
  overdueAppId?: string | null;
  starAppId?: string | null;
  latestAppId?: string | null;
}): CoachAction[] {
  const actions: CoachAction[] = [];
  if (input.overdueAppId) {
    actions.push({
      id: "schedule-followup",
      label: "Schedule today’s follow-up",
      href: `/api/coach/followup/schedule?applicationId=${input.overdueAppId}`,
    });
  }
  if (input.starAppId) {
    actions.push({
      id: "create-star",
      label: "Create a STAR draft for your biggest gap",
      href: `/api/coach/star/create?applicationId=${input.starAppId}`,
    });
  }
  if (input.latestAppId) {
    actions.push({
      id: "run-wizard",
      label: "Run Apply Kit Wizard on latest application",
      href: `/app/applications/${input.latestAppId}?tab=overview#apply-kit-wizard`,
    });
  }
  return actions.slice(0, 3);
}

export function nextBusinessDate(offsetDays = 2) {
  const now = new Date();
  return addBusinessDays(now, offsetDays).toISOString();
}
