import { logMonetisationEvent } from "@/lib/monetisation";

const ALLOWED = [
  "gate_shown",
  "gate_blocked",
  "billing_clicked",
  "checkout_started",
  "checkout_success",
  "resume_banner_shown",
  "resume_clicked",
  "autopack_generated",
] as const;

export type MonetisationClientEvent = (typeof ALLOWED)[number];

export function logMonetisationClientEvent(
  event: MonetisationClientEvent,
  applicationId: string,
  surface: string
) {
  if (typeof window === "undefined") return;
  try {
    fetch("/api/monetisation/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, applicationId, surface }),
      credentials: "include",
    }).catch(() => undefined);
  } catch {
    /* ignore */
  }
}
