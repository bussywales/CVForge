import { computeStreak, getIsoWeekKey, type WeeklyReviewSummary } from "@/lib/weekly-review";

export type RetentionRisk = "low" | "medium" | "high";

export type RetentionSaveOffer = {
  show: boolean;
  suggestedPlanKey?: "monthly_30" | "monthly_80";
  reasonBullets: string[];
};

export type RetentionSummary = {
  creditsUsed: number;
  completions: number;
  movedForward: number;
  streak: number;
  risk: RetentionRisk;
  recommendedSaveAction: string;
  saveOffer: RetentionSaveOffer;
};

type CreditLedgerEntry = {
  delta: number | null;
  created_at: string;
};

type TopAction = {
  id: string;
  href: string;
  label: string;
  applicationId?: string;
};

export function buildSubscriptionRetention(options: {
  planKey: "monthly_30" | "monthly_80";
  weekKey?: string;
  ledger: CreditLedgerEntry[];
  weeklyReview?: WeeklyReviewSummary | null;
  topActions?: TopAction[];
  streakThreshold?: number;
  completionsOverride?: number;
}): RetentionSummary {
  const weekKey = options.weekKey ?? getIsoWeekKey(new Date());
  const { creditsUsed, completions, streak } = computeWeeklyUsage(options.ledger, weekKey, options.streakThreshold ?? 3, options.completionsOverride);
  const movedForward = options.weeklyReview?.applicationsMoved ?? 0;
  const risk = computeRetentionRisk({ completions, movedForward });
  const recommendedSaveAction = pickRecommendedAction(options.topActions ?? []);
  const saveOffer = buildSaveOffer({
    planKey: options.planKey,
    risk,
    creditsUsed,
    completions,
  });

  return {
    creditsUsed,
    completions,
    movedForward,
    streak,
    risk,
    recommendedSaveAction,
    saveOffer,
  };
}

export function computeRetentionRisk(input: {
  completions: number;
  movedForward: number;
}): RetentionRisk {
  if (input.completions === 0 && input.movedForward === 0) return "high";
  if (input.completions > 0 && input.movedForward === 0) return "medium";
  return "low";
}

export function computeWeeklyUsage(
  ledger: CreditLedgerEntry[],
  weekKey: string,
  streakThreshold: number,
  completionsOverride?: number
): { creditsUsed: number; completions: number; streak: number } {
  const perWeekCounts: Record<string, number> = {};
  let creditsUsed = 0;
  let completions = 0;

  ledger.forEach((entry) => {
    if (!entry?.created_at) return;
    const entryWeek = getIsoWeekKey(new Date(entry.created_at));
    if (entry.delta !== null && entry.delta < 0) {
      creditsUsed += Math.abs(entry.delta);
      perWeekCounts[entryWeek] = (perWeekCounts[entryWeek] ?? 0) + 1;
      if (entryWeek === weekKey) {
        completions += 1;
      }
    }
  });

  if (typeof completionsOverride === "number") {
    completions = completionsOverride;
    perWeekCounts[weekKey] = completionsOverride;
  }

  const streak = computeStreak(perWeekCounts, weekKey, streakThreshold);

  return { creditsUsed, completions, streak };
}

function pickRecommendedAction(actions: TopAction[]): string {
  const mappings: Array<{ match: RegExp; label: string }> = [
    { match: /jobtext|job[-_]text|overview/i, label: "Add job text" },
    { match: /evidence|role[-_]fit/i, label: "Select evidence" },
    { match: /star/i, label: "Draft 1 STAR" },
    { match: /answer[-_]?pack|practice|drill/i, label: "Generate Answer Pack" },
    { match: /followup|activity/i, label: "Send follow-up" },
  ];
  for (const action of actions) {
    for (const map of mappings) {
      if (map.match.test(action.id) || map.match.test(action.href)) {
        return map.label;
      }
    }
  }
  return "Do a quick step";
}

function buildSaveOffer(input: {
  planKey: "monthly_30" | "monthly_80";
  risk: RetentionRisk;
  creditsUsed: number;
  completions: number;
}): RetentionSaveOffer {
  const reasonBullets: string[] = [];
  if (input.planKey === "monthly_80" && input.risk === "high" && input.creditsUsed < 20) {
    reasonBullets.push("Usage is light this week.");
    reasonBullets.push("Switch to Monthly 30 and keep access.");
    reasonBullets.push("You can switch back anytime.");
    return {
      show: true,
      suggestedPlanKey: "monthly_30",
      reasonBullets,
    };
  }

  if (
    input.planKey === "monthly_30" &&
    (input.creditsUsed >= 25 || input.completions >= 6)
  ) {
    reasonBullets.push("You’re using credits heavily.");
    reasonBullets.push("Monthly 80 prevents mid-week pauses.");
    reasonBullets.push("Switch now; cancel anytime.");
    return {
      show: true,
      suggestedPlanKey: "monthly_80",
      reasonBullets,
    };
  }

  return {
    show: false,
    reasonBullets,
  };
}
