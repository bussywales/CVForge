import type { CreditPack } from "@/lib/billing/packs-data";

type RecommendationInput = {
  credits: number;
  activeApplications: number;
  dueFollowups: number;
  practiceBacklog: number;
  stage?: "draft" | "submitted" | "interview" | "offer" | null;
};

type RecommendationResult = {
  recommendedPack: CreditPack["key"];
  reasons: string[];
  confidence: "high" | "medium" | "low";
};

export function recommendPack(input: RecommendationInput): RecommendationResult {
  const reasons: string[] = [];
  let recommended: CreditPack["key"] = "starter";
  let confidence: RecommendationResult["confidence"] = "low";

  if (input.activeApplications >= 6 || input.dueFollowups >= 5 || input.practiceBacklog >= 10) {
    recommended = "power";
    confidence = "high";
  } else if (
    input.activeApplications >= 3 ||
    input.dueFollowups >= 2 ||
    input.practiceBacklog >= 5
  ) {
    recommended = "pro";
    confidence = "medium";
  } else {
    recommended = "starter";
    confidence = "medium";
  }

  if (input.activeApplications > 0) {
    reasons.push(`You have ${input.activeApplications} active application${input.activeApplications === 1 ? "" : "s"}.`);
  }
  if (input.dueFollowups > 0) {
    reasons.push(`${input.dueFollowups} follow-up${input.dueFollowups === 1 ? "" : "s"} due soon.`);
  }
  if (input.practiceBacklog > 0) {
    reasons.push(`${input.practiceBacklog} practice item${input.practiceBacklog === 1 ? "" : "s"} pending.`);
  }
  if (input.credits <= 2) {
    reasons.push(`Low balance (${input.credits} credits).`);
  }
  if (reasons.length === 0) {
    reasons.push("Keep momentum with a small top-up.");
  }

  return { recommendedPack: recommended, reasons: reasons.slice(0, 3), confidence };
}
