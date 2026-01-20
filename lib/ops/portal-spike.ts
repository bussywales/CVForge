import type { IncidentRecord } from "@/lib/ops/incidents-shared";

export type PortalSpike = {
  spike: boolean;
  total: number;
  codes: Array<{ code: string; count: number }>;
};

export function detectPortalSpike(incidents: IncidentRecord[], threshold = 3): PortalSpike {
  const counts = new Map<string, number>();
  let total = 0;
  incidents.forEach((inc) => {
    const event = inc.eventName ?? "";
    const surface = inc.surface ?? "";
    const code = inc.code ?? "unknown";
    if (event === "billing_portal_error" || surface === "portal" || code.toLowerCase().includes("portal")) {
      total += 1;
      const key = code || "unknown";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  });
  const codes = Array.from(counts.entries())
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count);
  return { spike: total >= threshold, total, codes };
}

