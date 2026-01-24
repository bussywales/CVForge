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
  ops_alerts_test_sent_success: "day",
  ops_alerts_test_sent_deduped: "day",
  ops_alerts_test_success: "day",
  ops_alerts_test_error: "day",
  ops_alerts_test_cooldown_started: "day",
  ops_alerts_test_cooldown_ended: "day",
  ops_alerts_test_events_auto_expand: "day",
  ops_alerts_webhook_notify_sent: "day",
  ops_alerts_notify_attempt: "day",
  ops_alerts_notify_delivered: "day",
  ops_alerts_notify_failed: "day",
  ops_alerts_ack_token_created: "day",
  ops_alerts_ack_token_minted: "day",
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
