export type BasicStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const DEDUPE_PERIODS: Record<string, "day" | "week"> = {
  activation_view: "day",
  activation_cta_click: "day",
  activation_step_click: "day",
  activation_primary_cta_click: "day",
  keep_momentum_view: "week",
  keep_momentum_cta_click: "week",
  keep_momentum_secondary_click: "week",
  billing_delay_classified: "day",
  billing_recheck_rate_limited: "day",
  billing_resolution_confirm_yes: "day",
  billing_resolution_confirm_no: "day",
  ops_action_rate_limited: "day",
  ops_billing_resolution_mark_resolved: "day",
  ops_resolution_outcome_set: "day",
  ops_playbook_suppressed_view: "day",
  ops_resolution_effectiveness_view: "day",
  ops_resolutions_due_view: "day",
  billing_webhook_signal_view: "day",
  billing_webhook_badge_view_v2: "day",
  billing_webhook_badge_view: "day",
  ops_webhook_queue_view: "day",
  ops_webhook_chip_click: "day",
  ops_webhooks_queue_view: "day",
  ops_webhooks_queue_empty_view: "day",
  ops_webhooks_queue_filter_chip_click: "day",
  ops_system_status_view: "day",
  ops_status_triage_view: "day",
  ops_status_triage_action_click: "day",
  ops_case_search_submit: "day",
  ops_case_search_clear: "day",
  ops_case_view: "day",
  ops_case_view_open: "day",
  ops_case_snippet_copy: "day",
  ops_case_notes_save: "day",
  ops_case_checklist_toggle: "day",
  ops_case_close: "day",
  ops_case_training_evidence_copy: "day",
  ops_case_claim: "day",
  ops_case_release: "day",
  ops_case_assign: "day",
  ops_case_status_change: "day",
  ops_case_priority_change: "day",
  ops_case_evidence_add: "day",
  ops_case_template_copy: "day",
  ops_case_conflict: "day",
  ops_case_load_error: "day",
  ops_case_alerts_view: "day",
  ops_case_alerts_open_click: "day",
  ops_case_incidents_view: "day",
  ops_case_incidents_open_click: "day",
  ops_case_incidents_widen_click: "day",
  ops_case_audits_view: "day",
  ops_case_audits_open_click: "day",
  ops_case_webhooks_view: "day",
  ops_case_webhooks_open_click: "day",
  ops_case_billing_view: "day",
  ops_case_billing_recheck_click: "day",
  ops_case_billing_open_click: "day",
  ops_case_resolution_view: "day",
  ops_case_resolution_open_click: "day",
  ops_case_watch_open_click: "day",
  ops_case_context_fetch: "day",
  ops_case_context_resolve: "day",
  ops_case_context_upsert: "day",
  ops_case_context_attach: "day",
  ops_case_context_copy_userId: "day",
  ops_case_audit_view: "day",
  ops_cases_view: "day",
  ops_cases_view_selected: "day",
  ops_cases_view_saved: "day",
  ops_cases_view_saved_as: "day",
  ops_cases_view_manage: "day",
  ops_cases_filter_change: "day",
  ops_cases_filter_chip_clicked: "day",
  ops_cases_sort_change: "day",
  ops_cases_sort_changed: "day",
  ops_cases_sla_filter_used: "day",
  ops_cases_sla_tooltip_opened: "day",
  ops_cases_poll_tick: "day",
  ops_cases_copy_request_id: "day",
  ops_cases_copy_user_id: "day",
  ops_cases_copy_reason: "day",
  ops_cases_claim: "day",
  ops_cases_release: "day",
  ops_cases_status_change: "day",
  ops_cases_priority_change: "day",
  ops_cases_open_case: "day",
  ops_cases_open_why: "day",
  ops_cases_open_case_clicked: "day",
  ops_case_back_to_queue_clicked: "day",
  ops_cases_summary_view: "day",
  ops_cases_load_error: "day",
  ops_cases_reason_render: "day",
  pack_created: "day",
  pack_generated: "day",
  pack_generation_failed: "day",
  pack_export_clicked: "day",
  pack_exported: "day",
  pack_version_selected: "day",
  ops_request_context_upsert: "day",
  ops_status_rag_view: "day",
  ops_status_rag_drilldown_view: "day",
  ops_status_rag_signal_click: "day",
  ops_status_rag_trend_view: "day",
  ops_status_rag_trend_direction: "day",
  ops_status_top_repeats_view: "day",
  ops_status_top_repeats_click: "day",
  ops_status_top_repeats_watch_click: "day",
  ops_panel_rate_limited: "day",
  ops_panel_fetch_error: "day",
  ops_incidents_widen_click: "day",
  ops_incidents_from_alerts_view: "day",
  ops_alerts_view: "day",
  ops_alerts_refresh_click: "day",
  ops_alert_action_click: "day",
  ops_alert_transition: "day",
  ops_alert_notify_attempt: "day",
  ops_alert_notify_success: "day",
  ops_alert_notify_fail: "day",
  ops_alert_test_fire: "day",
  ops_alerts_test_click: "day",
  ops_alerts_test_send_click: "day",
  ops_alerts_test_send_clicked: "day",
  ops_alerts_test_sent_success: "day",
  ops_alerts_test_sent_deduped: "day",
  ops_alerts_test_success: "day",
  ops_alerts_test_error: "day",
  ops_alerts_test_cooldown_started: "day",
  ops_alerts_test_cooldown_ended: "day",
  ops_alerts_test_events_auto_expand: "day",
  ops_alerts_test_poll_start: "day",
  ops_alerts_test_poll_stop: "day",
  ops_alerts_test_poll_found: "day",
  ops_alerts_webhook_test_click: "day",
  ops_alerts_webhook_test_queued: "day",
  ops_alerts_deliveries_view: "day",
  ops_alerts_deliveries_filter_click: "day",
  ops_alerts_delivery_row_expand: "day",
  ops_alerts_delivery_support_copy: "day",
  ops_alerts_webhook_config_view: "day",
  ops_alerts_webhook_not_configured_blocked: "day",
  ops_alerts_webhook_notify_sent: "day",
  ops_alerts_notify_attempt: "day",
  ops_alerts_notify_delivered: "day",
  ops_alerts_notify_failed: "day",
  ops_alerts_ack_token_created: "day",
  ops_alerts_ack_token_mint_success: "day",
  ops_alerts_ack_token_mint_error: "day",
  ops_alerts_ack_public_success: "day",
  ops_alerts_ack_public_error: "day",
  ops_alerts_ack_click: "day",
  ops_alerts_ack_link_copy: "day",
  ops_alerts_ack_link_open: "day",
  ops_alerts_ack_ui_state_change: "day",
  alerts_ack_public_success: "day",
  alerts_ack_public_failed: "day",
  ops_alerts_delivery_view: "day",
  ops_alerts_delivery_copy_ref: "day",
  ops_alerts_ack_view: "day",
  ops_alerts_ack_submit: "day",
  ops_alerts_ack_submit_success: "day",
  ops_alerts_ack_submit_deduped: "day",
  ops_alerts_ack_submit_error: "day",
  ops_alerts_ack_curl_copy: "day",
  ops_alert_claim_click: "day",
  ops_alert_claim_success: "day",
  ops_alert_claim_error: "day",
  ops_alert_release_click: "day",
  ops_alert_release_success: "day",
  ops_alert_release_error: "day",
  ops_alert_snooze_click: "day",
  ops_alert_snooze_success: "day",
  ops_alert_snooze_error: "day",
  ops_alert_unsnooze_click: "day",
  ops_alert_unsnooze_success: "day",
  ops_alert_unsnooze_error: "day",
  ops_alert_handoff_note_save: "day",
  ops_alert_workflow_load_error: "day",
  ops_alerts_load_error: "day",
  ops_alerts_load_ok: "day",
  ops_alerts_webhook_setup_click: "day",
  ops_alert_handled_click: "day",
  ops_alert_handled_save: "day",
  ops_alert_handled_error: "day",
  ops_alert_handled_view: "day",
  ops_help_view: "day",
  ops_help_search: "day",
  ops_help_toc_click: "day",
  ops_help_copy_link_click: "day",
  ops_help_training_view: "day",
  ops_help_drill_view: "day",
  ops_help_drill_action_click: "day",
  ops_help_quickcard_view: "day",
  ops_help_template_copy: "day",
  ops_help_print_view_toggle: "day",
  ops_help_training_report_copied: "day",
  ops_training_scenario_create_click: "day",
  ops_training_scenario_created: "day",
  ops_training_scenario_deactivate_click: "day",
  ops_training_link_click: "day",
  ops_training_list_view: "day",
  ops_training_prefilled_link_opened: "day",
  ops_training_scenario_marked: "day",
  ops_training_copy_request_id: "day",
  ops_training_copy_event_id: "day",
  ops_training_copy_all_ids: "day",
  ops_training_open_case: "day",
  ops_access_invite_view: "day",
  ops_access_invite_grant: "day",
  ops_access_invite_revoke: "day",
  ops_access_invite_copy_instructions: "day",
  ops_early_access_search: "day",
  ops_early_access_invite_create: "day",
  ops_early_access_invite_copy_link: "day",
  ops_early_access_invite_copy_instructions: "day",
  ops_early_access_invite_revoke: "day",
  early_access_invite_claim_attempt: "day",
  early_access_invite_claim_success: "day",
  early_access_invite_claim_skipped: "day",
  early_access_gate_allowed: "day",
  early_access_gate_blocked: "day",
  onboarding_card_view: "day",
  onboarding_step_cta_click: "day",
  onboarding_skip_week: "day",
  onboarding_dismiss_local: "day",
  onboarding_step_auto_completed: "day",
  onboarding_completed: "day",
  invite_attribution_claim_attempt: "day",
  invite_attribution_claim_success: "day",
  invite_attribution_claim_already_claimed: "day",
  invite_attribution_claim_failed: "day",
  ops_funnel_view: "day",
  ops_funnel_refresh: "day",
  ops_funnel_rate_limited: "day",
  invite_landing_view: "day",
  invite_landing_continue_click: "day",
  invite_landing_claim_click: "day",
  invite_landing_invalid_view: "day",
  invite_support_snippet_copy: "day",
  invite_claim_banner_view: "day",
  invite_claim_banner_retry_click: "day",
  invite_claim_banner_copy: "day",
  invite_claim_banner_dismiss: "day",
  invite_claim_success_banner_view: "day",
  invite_claim_success_cta_click: "day",
  invite_claim_fail_why_open: "day",
  ops_funnel_groupby_source_view: "day",
  ops_funnel_filter_change: "day",
  ops_funnel_copy_link: "day",
  ops_user_invite_attribution_view: "day",
  ops_access_invite_template_copy: "day",
  early_access_block_view: "day",
  early_access_block_copy: "day",
  ops_access_view: "day",
  ops_access_lookup: "day",
  ops_access_grant: "day",
  ops_access_revoke: "day",
  ops_access_error: "day",
  system_status_limits_view: "day",
  billing_help_prompt_view: "day",
};

const DEDUPE_STORAGE_KEY = "cvf-monetisation-dedupe";
const MAX_STORE_ENTRIES = 50;
const URL_PATTERN = /https?:\/\/\S+/i;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const MAX_VALUE_LENGTH = 120;

function getPeriodKey(period: "day" | "week", now: number) {
  const date = new Date(now);
  const utcDate = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  if (period === "day") {
    return new Date(utcDate).toISOString().slice(0, 10);
  }
  const weekStart = new Date(utcDate);
  const weekday = weekStart.getUTCDay(); // 0 (Sun) - 6 (Sat)
  const daysFromMonday = (weekday + 6) % 7;
  weekStart.setUTCDate(weekStart.getUTCDate() - daysFromMonday);
  return weekStart.toISOString().slice(0, 10);
}

export function shouldDedupMonetisationEvent(event: string, storage?: BasicStorage | null, now = Date.now()) {
  const period = DEDUPE_PERIODS[event];
  if (!period || !storage) return false;

  try {
    const raw = storage.getItem(DEDUPE_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    const key = `${event}:${getPeriodKey(period, now)}`;
    if (parsed[key]) return true;

    parsed[key] = now;
    const entries = Object.entries(parsed).sort(([, a], [, b]) => b - a).slice(0, MAX_STORE_ENTRIES);
    const pruned: Record<string, number> = {};
    for (const [k, v] of entries) {
      pruned[k] = v;
    }
    storage.setItem(DEDUPE_STORAGE_KEY, JSON.stringify(pruned));
  } catch {
    return false;
  }

  return false;
}

export function sanitizeMonetisationMeta(meta?: Record<string, any>) {
  if (!meta || typeof meta !== "object") return {};
  const safe: Record<string, any> = {};

  for (const [key, value] of Object.entries(meta)) {
    if (value === undefined) continue;
    if (value === null) {
      safe[key] = null;
      continue;
    }

    if (typeof value === "string") {
      if (EMAIL_PATTERN.test(value)) {
        safe[key] = "[email-redacted]";
        continue;
      }
      if (URL_PATTERN.test(value)) {
        safe[key] = "[url-redacted]";
        continue;
      }
      const trimmed = value.length > MAX_VALUE_LENGTH ? `${value.slice(0, MAX_VALUE_LENGTH)}...` : value;
      safe[key] = trimmed;
      continue;
    }

    if (typeof value === "number" || typeof value === "boolean") {
      safe[key] = value;
      continue;
    }

    const summary = (() => {
      try {
        return JSON.stringify(value);
      } catch {
        return "";
      }
    })();
    safe[key] = summary && summary.length <= MAX_VALUE_LENGTH ? summary : "[omitted]";
  }

  return safe;
}
