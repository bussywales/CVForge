import type { SupabaseClient } from "@supabase/supabase-js";
import { createApplicationActivity } from "@/lib/data/application-activities";

export type MonetisationEventName =
  | "gate_shown"
  | "gate_blocked"
  | "billing_clicked"
  | "billing_viewed"
  | "billing_return"
  | "billing_success_banner_view"
  | "billing_success_banner_resume_click"
  | "billing_success_banner_dismiss"
  | "resume_completed"
  | "resume_next_step_click"
  | "pack_recommended"
  | "checkout_started"
  | "checkout_redirect_failed"
  | "checkout_retry_click"
  | "checkout_help_open"
  | "checkout_start_failed"
  | "checkout_success"
  | "autopack_generate_completed"
  | "interview_pack_export_completed"
  | "application_kit_download_completed"
  | "answer_pack_generate_completed"
  | "completion_watchdog_view"
  | "completion_watchdog_back_click"
  | "completion_watchdog_mark_done"
  | "completion_watchdog_dismiss"
  | "credits_idle_nudge_view"
  | "credits_idle_nudge_click"
  | "credits_idle_nudge_dismiss"
  | "billing_sub_reco_view"
  | "billing_sub_reco_click"
  | "billing_sub_reco_checkout_started"
  | "billing_sub_reco_checkout_failed"
  | "sub_nudge_view"
  | "sub_nudge_click_start"
  | "sub_nudge_click_manage"
  | "sub_gate_upsell_view"
  | "sub_gate_upsell_click"
  | "sub_post_purchase_tip_view"
  | "sub_post_purchase_tip_click"
  | "sub_recovery_upsell_view"
  | "sub_recovery_upsell_click"
  | "sub_gate_view"
  | "sub_gate_click_subscribe"
  | "sub_gate_not_now"
  | "sub_gate_checkout_start_failed"
  | "sub_gate_plan_unavailable"
  | "sub_post_purchase_view"
  | "sub_post_purchase_auto_redirect"
  | "sub_post_purchase_resume_click"
  | "sub_post_purchase_not_now"
  | "sub_completion_nudge_view"
  | "sub_completion_nudge_completed"
  | "sub_completion_nudge_dismiss"
  | "billing_plan_unavailable"
  | "resume_banner_shown"
  | "resume_clicked"
  | "resume_dismissed"
  | "autopack_generated"
  | "billing_pack_unavailable";

export async function logMonetisationEvent(
  supabase: SupabaseClient,
  userId: string,
  event: MonetisationEventName,
  opts?: {
    applicationId?: string | null;
    surface?: string | null;
    meta?: Record<string, any>;
  }
) {
  const applicationId = opts?.applicationId;
  if (!applicationId) return; // require application context for now
  const meta = {
    surface: opts?.surface ?? null,
    ...((opts?.meta as Record<string, any>) ?? {}),
  };
  await createApplicationActivity(supabase, userId, {
    application_id: applicationId,
    type: `monetisation.${event}`,
    channel: null,
    subject: opts?.surface ?? event,
    body: JSON.stringify(meta),
    occurred_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  } as any);
}
