import { logMonetisationEvent } from "@/lib/monetisation";

const ALLOWED = [
  "gate_shown",
  "gate_blocked",
  "billing_clicked",
  "billing_viewed",
  "billing_return",
  "billing_success_banner_view",
  "billing_success_banner_resume_click",
  "billing_success_banner_dismiss",
  "resume_completed",
  "resume_next_step_click",
  "pack_recommended",
  "checkout_started",
  "checkout_redirect_failed",
  "checkout_retry_click",
  "checkout_help_open",
  "checkout_start_failed",
  "checkout_success",
  "autopack_generate_completed",
  "interview_pack_export_completed",
  "application_kit_download_completed",
  "answer_pack_generate_completed",
  "completion_watchdog_view",
  "completion_watchdog_back_click",
  "completion_watchdog_mark_done",
  "completion_watchdog_dismiss",
  "credits_idle_nudge_view",
  "credits_idle_nudge_click",
  "credits_idle_nudge_dismiss",
  "billing_sub_reco_view",
  "billing_sub_reco_click",
  "billing_sub_reco_checkout_started",
  "billing_sub_reco_checkout_failed",
  "sub_nudge_view",
  "sub_nudge_click_start",
  "sub_nudge_click_manage",
  "sub_gate_upsell_view",
  "sub_gate_upsell_click",
  "sub_post_purchase_tip_view",
  "sub_post_purchase_tip_click",
  "sub_recovery_upsell_view",
  "sub_recovery_upsell_click",
  "sub_gate_view",
  "sub_gate_click_subscribe",
  "sub_gate_not_now",
  "sub_gate_checkout_start_failed",
  "sub_gate_plan_unavailable",
  "sub_selector_view",
  "sub_selector_change_plan",
  "sub_selector_start_checkout",
  "sub_selector_plan_unavailable",
  "sub_selector_manage_portal_click",
  "sub_reco_reason_impression",
  "sub_post_purchase_view",
  "sub_post_purchase_auto_redirect",
  "sub_post_purchase_resume_click",
  "sub_post_purchase_not_now",
  "sub_completion_nudge_view",
  "sub_completion_nudge_completed",
  "sub_completion_nudge_dismiss",
  "billing_compare_view",
  "billing_compare_choice_subscribe",
  "billing_compare_choice_topup",
  "gate_compare_view",
  "gate_compare_choice_subscribe",
  "gate_compare_choice_topup",
  "billing_plan_unavailable",
  "resume_banner_shown",
  "resume_clicked",
  "resume_dismissed",
  "autopack_generated",
  "billing_pack_unavailable",
] as const;

export type MonetisationClientEvent = (typeof ALLOWED)[number];

export function logMonetisationClientEvent(
  event: MonetisationClientEvent,
  applicationId?: string | null,
  surface?: string | null,
  meta?: Record<string, any>
) {
  if (typeof window === "undefined") return;
  if (!applicationId) return;
  try {
    fetch("/api/monetisation/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, applicationId, surface, meta }),
      credentials: "include",
    }).catch(() => undefined);
  } catch {
    /* ignore */
  }
}

export function logCompletion(
  actionKey:
    | "autopack_generate_completed"
    | "interview_pack_export_completed"
    | "application_kit_download_completed"
    | "answer_pack_generate_completed",
  applicationId?: string | null,
  surface?: string | null,
  meta?: Record<string, any>
) {
  logMonetisationClientEvent(actionKey, applicationId, surface ?? "applications", meta);
  if (typeof window !== "undefined" && applicationId) {
    window.dispatchEvent(
      new CustomEvent("cvf-action-completed", {
        detail: { applicationId, actionKey },
      })
    );
  }
}
