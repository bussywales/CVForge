import type { IncidentRecord } from "@/lib/ops/incidents-shared";

export type BillingDelayBuckets = {
  window24h: Record<string, number>;
  window7d: Record<string, number>;
};

function within(at: string, now: Date, hours: number) {
  const ts = new Date(at);
  if (Number.isNaN(ts.getTime())) return false;
  return (now.getTime() - ts.getTime()) / (1000 * 60 * 60) <= hours;
}

function extractDelayState(incident: IncidentRecord) {
  const ctx = incident.context as Record<string, any> | undefined;
  const fromCtx = typeof ctx?.delayState === "string" ? ctx.delayState : null;
  const code = (incident.code ?? "").toLowerCase();
  const message = (incident.message ?? "").toLowerCase();
  if (fromCtx) return fromCtx;
  if (code.includes("waiting_webhook") || message.includes("waiting_webhook")) return "waiting_webhook";
  if (code.includes("waiting_ledger") || message.includes("waiting_ledger")) return "waiting_ledger";
  if (code.includes("ui_stale") || message.includes("ui_stale")) return "ui_stale";
  if (code.includes("unknown_delay") || message.includes("unknown_delay")) return "unknown";
  return null;
}

export function buildBillingDelayBuckets(incidents: IncidentRecord[], now = new Date()): BillingDelayBuckets {
  const window24h: Record<string, number> = { waiting_webhook: 0, waiting_ledger: 0, ui_stale: 0, unknown: 0 };
  const window7d: Record<string, number> = { waiting_webhook: 0, waiting_ledger: 0, ui_stale: 0, unknown: 0 };

  incidents.forEach((inc) => {
    const delayState = extractDelayState(inc);
    if (!delayState) return;
    if (within(inc.at, now, 24)) {
      window24h[delayState] = (window24h[delayState] ?? 0) + 1;
    }
    if (within(inc.at, now, 24 * 7)) {
      window7d[delayState] = (window7d[delayState] ?? 0) + 1;
    }
  });

  return { window24h, window7d };
}
