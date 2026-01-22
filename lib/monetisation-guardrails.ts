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
  ops_alerts_view: "day",
  ops_alerts_refresh_click: "day",
  ops_alert_action_click: "day",
  ops_alert_transition: "day",
  ops_alert_notify_attempt: "day",
  ops_alert_notify_success: "day",
  ops_alert_notify_fail: "day",
  ops_alert_test_fire: "day",
  ops_access_invite_view: "day",
  ops_access_invite_grant: "day",
  ops_access_invite_revoke: "day",
  ops_access_invite_copy_instructions: "day",
  early_access_gate_allowed: "day",
  early_access_gate_blocked: "day",
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
