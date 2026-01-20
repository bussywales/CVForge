import type { CreditLedgerEntry } from "@/lib/data/credits";

type MonetisationEvent = {
  type: string;
  occurred_at: string;
  body: string | null;
};

export type BillingTimelineEntry = {
  kind: "portal_open" | "portal_error" | "checkout_started" | "checkout_error" | "checkout_success" | "webhook_received" | "webhook_error" | "credits_applied";
  at: string;
  status: "ok" | "error" | "info";
  requestId?: string | null;
  label: string;
};

function parseMeta(body: string | null): Record<string, any> {
  if (!body) return {};
  try {
    return JSON.parse(body);
  } catch {
    return {};
  }
}

function toEventName(raw: string) {
  return raw.replace("monetisation.", "");
}

export function buildBillingTimeline({
  events,
  ledger,
  limit = 5,
}: {
  events: MonetisationEvent[];
  ledger: CreditLedgerEntry[];
  limit?: number;
}): BillingTimelineEntry[] {
  const timeline: BillingTimelineEntry[] = [];

  events.forEach((evt) => {
    const name = toEventName(evt.type);
    const meta = parseMeta(evt.body);
    const requestId = typeof meta.requestId === "string" ? meta.requestId : typeof meta.request_id === "string" ? meta.request_id : null;
    if (name === "billing_portal_click" || name === "sub_portal_opened") {
      timeline.push({ kind: "portal_open", at: evt.occurred_at, status: "info", requestId, label: "Opened portal" });
    } else if (name === "billing_portal_error" || name === "billing_portal_error_banner_view" || name === "sub_portal_open_failed") {
      timeline.push({ kind: "portal_error", at: evt.occurred_at, status: "error", requestId, label: "Portal error" });
    } else if (name === "checkout_started") {
      timeline.push({ kind: "checkout_started", at: evt.occurred_at, status: "info", requestId, label: "Checkout started" });
    } else if (name === "checkout_start_failed" || name === "checkout_redirect_blocked" || name === "checkout_retry_click") {
      timeline.push({ kind: "checkout_error", at: evt.occurred_at, status: "error", requestId, label: "Checkout issue" });
    } else if (name === "checkout_success") {
      timeline.push({ kind: "checkout_success", at: evt.occurred_at, status: "ok", requestId, label: "Checkout success" });
    } else if (name === "webhook_error") {
      timeline.push({ kind: "webhook_error", at: evt.occurred_at, status: "error", requestId, label: "Webhook error" });
    } else if (name === "webhook_received") {
      timeline.push({ kind: "webhook_received", at: evt.occurred_at, status: "info", requestId, label: "Webhook received" });
    }
  });

  ledger.forEach((entry) => {
    if ((entry.delta ?? 0) > 0) {
      timeline.push({
        kind: "credits_applied",
        at: entry.created_at,
        status: "ok",
        requestId: entry.ref,
        label: "Credits applied",
      });
    }
  });

  return timeline
    .sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""))
    .slice(0, limit);
}
