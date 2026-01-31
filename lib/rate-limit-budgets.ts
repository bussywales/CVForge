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
  | "ops_alerts_webhook_test"
  | "ops_alerts_ack"
  | "ops_alerts_ack_token"
  | "alerts_ack_public"
  | "ops_alerts_claim"
  | "ops_alerts_release"
  | "ops_alerts_snooze"
  | "ops_alerts_unsnooze"
  | "ops_alerts_workflow_get"
  | "ops_alerts_deliveries_get"
  | "ops_training_scenarios_get"
  | "ops_training_scenarios_post"
  | "ops_training_scenarios_deactivate"
  | "ops_training_scenarios_mark"
  | "ops_incidents_preview"
  | "ops_resolution_outcomes_recent"
  | "ops_case_context_get"
  | "ops_case_context_attach"
  | "ops_case_notes_get"
  | "ops_case_notes_upsert"
  | "ops_case_get"
  | "ops_case_claim"
  | "ops_case_release"
  | "ops_case_status"
  | "ops_case_assign"
  | "ops_case_evidence"
  | "ops_case_close"
  | "ops_case_audit_get"
  | "ops_cases_list"
  | "ops_cases_summary"
  | "ops_cases_claim"
  | "ops_cases_release"
  | "ops_cases_update"
  | "ops_cases_views_list"
  | "ops_cases_views_write"
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
  ops_alerts_webhook_test: "medium",
  ops_alerts_ack: "low",
  ops_alerts_ack_token: "low",
  alerts_ack_public: "low",
  ops_alerts_claim: "medium",
  ops_alerts_release: "medium",
  ops_alerts_snooze: "medium",
  ops_alerts_unsnooze: "medium",
  ops_alerts_workflow_get: "medium",
  ops_alerts_deliveries_get: "medium",
  ops_training_scenarios_get: "medium",
  ops_training_scenarios_post: "medium",
  ops_training_scenarios_deactivate: "medium",
  ops_training_scenarios_mark: "medium",
  ops_incidents_preview: "medium",
  ops_resolution_outcomes_recent: "medium",
  ops_case_context_get: "medium",
  ops_case_context_attach: "low",
  ops_case_notes_get: "medium",
  ops_case_notes_upsert: "medium",
  ops_case_get: "medium",
  ops_case_claim: "medium",
  ops_case_release: "medium",
  ops_case_status: "medium",
  ops_case_assign: "low",
  ops_case_evidence: "medium",
  ops_case_close: "low",
  ops_case_audit_get: "medium",
  ops_cases_list: "medium",
  ops_cases_summary: "medium",
  ops_cases_claim: "medium",
  ops_cases_release: "medium",
  ops_cases_update: "medium",
  ops_cases_views_list: "medium",
  ops_cases_views_write: "medium",
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
