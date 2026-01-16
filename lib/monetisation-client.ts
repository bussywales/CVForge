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
