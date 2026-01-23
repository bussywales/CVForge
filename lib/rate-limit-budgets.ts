type BudgetKey =
  | "monetisation_log"
  | "billing_recheck"
  | "billing_portal"
  | "ops_system_status"
  | "ops_rag_status"
  | "ops_webhooks"
  | "ops_resolution_outcome"
  | "ops_resolution_effectiveness"
  | "ops_watch"
  | "ops_access_get"
  | "ops_access_grant"
  | "ops_access_revoke"
  | "ops_access_invite_create"
  | "ops_access_invite_revoke"
  | "ops_alerts_get"
  | "ops_alerts_test"
  | "onboarding_model_get"
  | "onboarding_skip_post"
  | "invite_claim"
  | "invite_validate"
  | "ops_funnel_get";

type BudgetLevel = "high" | "medium" | "low";

const LEVELS: Record<BudgetLevel, { limit: number; windowMs: number }> = {
  high: { limit: 300, windowMs: 5 * 60 * 1000 },
  medium: { limit: 80, windowMs: 5 * 60 * 1000 },
  low: { limit: 20, windowMs: 5 * 60 * 1000 },
};

const ROUTE_BUDGETS: Record<BudgetKey, BudgetLevel> = {
  monetisation_log: "high",
  billing_recheck: "low",
  billing_portal: "medium",
  ops_system_status: "medium",
  ops_rag_status: "medium",
  ops_webhooks: "medium",
  ops_resolution_outcome: "medium",
  ops_resolution_effectiveness: "medium",
  ops_watch: "medium",
  ops_access_get: "medium",
  ops_access_grant: "medium",
  ops_access_revoke: "medium",
  ops_access_invite_create: "medium",
  ops_access_invite_revoke: "medium",
  ops_alerts_get: "medium",
  ops_alerts_test: "medium",
  onboarding_model_get: "medium",
  onboarding_skip_post: "medium",
  invite_claim: "medium",
  invite_validate: "low",
  ops_funnel_get: "medium",
};

export function getRateLimitBudget(route: BudgetKey) {
  const budget = ROUTE_BUDGETS[route] ?? "medium";
  const level = LEVELS[budget];
  return { budget, limit: level.limit, windowMs: level.windowMs };
}
