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
