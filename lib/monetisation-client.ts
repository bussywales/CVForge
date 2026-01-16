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
  "checkout_success",
  "resume_banner_shown",
  "resume_clicked",
  "resume_dismissed",
  "autopack_generated",
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
