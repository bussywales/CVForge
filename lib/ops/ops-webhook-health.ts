import type { IncidentRecord } from "@/lib/ops/incidents-shared";

export type OpsWebhookHealth = {
  status: "healthy" | "degraded" | "unknown";
  lastOkAt: string | null;
  lastErrorAt: string | null;
  lastErrorCode: string | null;
  counts24h: { ok: number; error: number };
  counts7d: { ok: number; error: number };
  topCodes: Array<{ code: string; count: number }>;
};

function within(at: string, now: Date, hours: number) {
  const ts = new Date(at);
  if (Number.isNaN(ts.getTime())) return false;
  return (now.getTime() - ts.getTime()) / (1000 * 60 * 60) <= hours;
}

export function buildOpsWebhookHealth(incidents: IncidentRecord[], now = new Date()): OpsWebhookHealth {
  const sorted = [...incidents].sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""));
  const counts24h = { ok: 0, error: 0 };
  const counts7d = { ok: 0, error: 0 };
  const codeCounts = new Map<string, number>();
  let lastOk: string | null = null;
  let lastError: { at?: string | null; code?: string | null } | null = null;

  sorted.forEach((inc) => {
    const isWebhook = (inc.eventName ?? "").toLowerCase().includes("webhook") || (inc.surface ?? "").toLowerCase() === "webhook";
    if (!isWebhook) return;
    const isError = (inc.code ?? "").toLowerCase().includes("error") || (inc.message ?? "").toLowerCase().includes("error");
    if (within(inc.at, now, 24)) {
      if (isError) counts24h.error += 1;
      else counts24h.ok += 1;
    }
    if (within(inc.at, now, 24 * 7)) {
      if (isError) {
        counts7d.error += 1;
        if (inc.code) {
          const key = inc.code.toLowerCase();
          codeCounts.set(key, (codeCounts.get(key) ?? 0) + 1);
        }
      } else {
        counts7d.ok += 1;
      }
    }
    if (!isError && !lastOk) lastOk = inc.at;
    if (isError && !lastError) lastError = { at: inc.at, code: inc.code ?? null };
  });

  const topCodes = Array.from(codeCounts.entries())
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  const status: OpsWebhookHealth["status"] = counts24h.error > 0 || counts7d.error > 0 ? "degraded" : counts24h.ok + counts7d.ok > 0 ? "healthy" : "unknown";

  const lastErrorAt = lastError ? (lastError as any).at ?? null : null;
  const lastErrorCode = lastError ? (lastError as any).code ?? null : null;

  return {
    status,
    lastOkAt: lastOk,
    lastErrorAt,
    lastErrorCode,
    counts24h,
    counts7d,
    topCodes,
  };
}
