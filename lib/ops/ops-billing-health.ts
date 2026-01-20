import type { IncidentRecord } from "@/lib/ops/incidents-shared";

export type BillingHealthWindow = {
  portalErrors: number;
  checkoutErrors: number;
  webhookErrors: number;
};

export type BillingHealthSummary = {
  window24h: BillingHealthWindow;
  window7d: BillingHealthWindow;
  topCodes: Array<{ code: string; count: number }>;
};

function withinWindow(at: string, now: Date, hours: number) {
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return false;
  const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
  return diffHours <= hours;
}

function isPortalError(incident: IncidentRecord) {
  const name = (incident.eventName ?? "").toLowerCase();
  const code = (incident.code ?? "").toLowerCase();
  return name.includes("portal") || incident.surface === "portal" || code.includes("portal");
}

function isCheckoutError(incident: IncidentRecord) {
  const name = (incident.eventName ?? "").toLowerCase();
  const code = (incident.code ?? "").toLowerCase();
  return name.includes("checkout") || incident.surface === "checkout" || code.includes("checkout");
}

function isWebhookError(incident: IncidentRecord) {
  const name = (incident.eventName ?? "").toLowerCase();
  const code = (incident.code ?? "").toLowerCase();
  return name.includes("webhook") || code.includes("webhook");
}

export function buildOpsBillingHealth(incidents: IncidentRecord[], now = new Date()): BillingHealthSummary {
  const window24h: BillingHealthWindow = { portalErrors: 0, checkoutErrors: 0, webhookErrors: 0 };
  const window7d: BillingHealthWindow = { portalErrors: 0, checkoutErrors: 0, webhookErrors: 0 };
  const codeCounts = new Map<string, number>();

  incidents.forEach((incident) => {
    if (!incident.at) return;
    const in24h = withinWindow(incident.at, now, 24);
    const in7d = withinWindow(incident.at, now, 24 * 7);
    const portal = isPortalError(incident);
    const checkout = isCheckoutError(incident);
    const webhook = isWebhookError(incident);

    if (in24h) {
      if (portal) window24h.portalErrors += 1;
      if (checkout) window24h.checkoutErrors += 1;
      if (webhook) window24h.webhookErrors += 1;
    }
    if (in7d) {
      if (portal) window7d.portalErrors += 1;
      if (checkout) window7d.checkoutErrors += 1;
      if (webhook) window7d.webhookErrors += 1;
      if (incident.code) {
        const key = incident.code.toLowerCase();
        codeCounts.set(key, (codeCounts.get(key) ?? 0) + 1);
      }
    }
  });

  const topCodes = Array.from(codeCounts.entries())
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  return { window24h, window7d, topCodes };
}
