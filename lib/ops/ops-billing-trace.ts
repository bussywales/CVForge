import type { IncidentRecord } from "@/lib/ops/incidents-shared";

export type BillingTraceSummary = {
  window24h: { checkoutSuccess: number; webhookReceived: number; webhookError: number; delayedCredit: number };
  window7d: { checkoutSuccess: number; webhookReceived: number; webhookError: number; delayedCredit: number };
  coverage: { ratio: number; label: string };
};

function within(at: string, now: Date, hours: number) {
  const ts = new Date(at);
  if (Number.isNaN(ts.getTime())) return false;
  return (now.getTime() - ts.getTime()) / (1000 * 60 * 60) <= hours;
}

function isCheckoutSuccess(incident: IncidentRecord) {
  return (incident.eventName ?? "").toLowerCase() === "checkout_success" || (incident.code ?? "").toLowerCase().includes("checkout_success");
}

function isWebhookReceived(incident: IncidentRecord) {
  return (incident.eventName ?? "").toLowerCase() === "webhook_received";
}

function isWebhookError(incident: IncidentRecord) {
  const name = (incident.eventName ?? "").toLowerCase();
  const code = (incident.code ?? "").toLowerCase();
  return name.includes("webhook_error") || code.includes("webhook_error");
}

function isDelayedCredit(incident: IncidentRecord) {
  const name = (incident.eventName ?? "").toLowerCase();
  const code = (incident.code ?? "").toLowerCase();
  return name.includes("delayed_credit") || code.includes("delayed_credit");
}

export function buildBillingTraceSummary(incidents: IncidentRecord[], now = new Date()): BillingTraceSummary {
  const window24h = { checkoutSuccess: 0, webhookReceived: 0, webhookError: 0, delayedCredit: 0 };
  const window7d = { checkoutSuccess: 0, webhookReceived: 0, webhookError: 0, delayedCredit: 0 };

  incidents.forEach((inc) => {
    const in24 = within(inc.at, now, 24);
    const in7d = within(inc.at, now, 24 * 7);
    const checkout = isCheckoutSuccess(inc);
    const webhookRec = isWebhookReceived(inc);
    const webhookErr = isWebhookError(inc);
    const delayed = isDelayedCredit(inc);

    if (in24) {
      if (checkout) window24h.checkoutSuccess += 1;
      if (webhookRec) window24h.webhookReceived += 1;
      if (webhookErr) window24h.webhookError += 1;
      if (delayed) window24h.delayedCredit += 1;
    }
    if (in7d) {
      if (checkout) window7d.checkoutSuccess += 1;
      if (webhookRec) window7d.webhookReceived += 1;
      if (webhookErr) window7d.webhookError += 1;
      if (delayed) window7d.delayedCredit += 1;
    }
  });

  const ratio =
    window24h.checkoutSuccess === 0 ? 0 : Math.round((window24h.webhookReceived / window24h.checkoutSuccess) * 100);

  return {
    window24h,
    window7d,
    coverage: { ratio, label: `${ratio}% webhook coverage (24h)` },
  };
}
