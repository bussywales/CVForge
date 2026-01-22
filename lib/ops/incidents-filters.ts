import type { IncidentRecord } from "@/lib/ops/incidents-shared";

export type IncidentFilters = {
  time: "0.25" | "1" | "24" | "168";
  surface: string;
  code: string;
  flow: string;
  search: string;
  highImpact: boolean;
  requestId?: string | null;
};

export function filterIncidents(incidents: IncidentRecord[], filters: IncidentFilters) {
  const now = Date.now();
  const windowMs = Number(filters.time) * 60 * 60 * 1000;
  const term = filters.search.toLowerCase().trim();
  const highImpactSurfaces: Array<IncidentRecord["surface"]> = ["billing", "checkout", "portal"];
  const requestFilter = (filters.requestId ?? "").trim();

  return incidents.filter((inc) => {
    if (now - new Date(inc.at).getTime() > windowMs) return false;
    if (filters.surface !== "all" && inc.surface !== filters.surface) return false;
    if (filters.code && inc.code !== filters.code) return false;
    if (filters.flow) {
      const flow = inc.flow ?? (inc.context?.flow as string | undefined) ?? (inc.context?.from as string | undefined);
      if (flow !== filters.flow) return false;
    }
    if (filters.highImpact && !highImpactSurfaces.includes(inc.surface)) return false;
    if (requestFilter && inc.requestId !== requestFilter) return false;
    if (term) {
      const haystack = `${inc.requestId} ${inc.message ?? ""} ${inc.code ?? ""} ${inc.emailMasked ?? ""} ${inc.userId ?? ""}`.toLowerCase();
      if (!haystack.includes(term)) return false;
    }
    return true;
  });
}
