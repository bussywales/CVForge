export type IncidentSurface = "billing" | "portal" | "checkout" | "outcomes" | "outreach" | "referrals" | "other" | "diagnostics";

export type IncidentRecord = {
  requestId: string;
  at: string;
  surface: IncidentSurface;
  code: string | null;
  message: string | null;
  userId: string | null;
  emailMasked?: string | null;
  context?: Record<string, unknown>;
  eventName?: string | null;
  flow?: string | null;
  path?: string | null;
  returnTo?: string | null;
};

export function buildGroupKey(incident: IncidentRecord) {
  const fingerprint = (incident.message ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  const flow = incident.flow ?? incident.context?.flow ?? incident.context?.from ?? "";
  return `${incident.surface}|${incident.code ?? "unknown"}|${fingerprint}|${flow}`;
}

export type IncidentGroup = {
  key: string;
  surface: IncidentSurface;
  code: string | null;
  message: string | null;
  flow: string | null;
  count: number;
  firstSeen: string;
  lastSeen: string;
  sampleRequestIds: string[];
  incidents: IncidentRecord[];
};

export function groupIncidents(incidents: IncidentRecord[]): IncidentGroup[] {
  const map = new Map<string, IncidentGroup>();
  incidents.forEach((inc) => {
    const key = buildGroupKey(inc);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        key,
        surface: inc.surface,
        code: inc.code,
        message: inc.message,
        flow: inc.flow ?? null,
        count: 1,
        firstSeen: inc.at,
        lastSeen: inc.at,
        sampleRequestIds: [inc.requestId],
        incidents: [inc],
      });
      return;
    }
    existing.count += 1;
    existing.incidents.push(inc);
    if (new Date(inc.at) < new Date(existing.firstSeen)) existing.firstSeen = inc.at;
    if (new Date(inc.at) > new Date(existing.lastSeen)) existing.lastSeen = inc.at;
    if (existing.sampleRequestIds.length < 5) {
      existing.sampleRequestIds.push(inc.requestId);
    }
  });

  return Array.from(map.values()).sort((a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime());
}

function matchesCorrelation(target: IncidentRecord, candidate: IncidentRecord) {
  if (target.requestId === candidate.requestId) return true;
  if (target.userId && candidate.userId && target.userId === candidate.userId) return true;
  if (target.emailMasked && candidate.emailMasked && target.emailMasked === candidate.emailMasked) return true;
  const targetFlow = target.flow ?? target.context?.flow ?? target.context?.from;
  const candidateFlow = candidate.flow ?? candidate.context?.flow ?? candidate.context?.from;
  if (targetFlow && candidateFlow && targetFlow === candidateFlow) return true;
  if (target.returnTo && candidate.returnTo && target.returnTo === candidate.returnTo) return true;
  if (target.path && candidate.path && target.path === candidate.path) return true;
  return false;
}

export function correlateIncidents(target: IncidentRecord, incidents: IncidentRecord[], windowMs = 10 * 60 * 1000) {
  const targetTime = new Date(target.at).getTime();
  return incidents
    .filter((inc) => {
      const dt = Math.abs(new Date(inc.at).getTime() - targetTime);
      return dt <= windowMs && matchesCorrelation(target, inc);
    })
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

export function buildIncidentsLink(requestId: string) {
  return `/app/ops/incidents?requestId=${encodeURIComponent(requestId)}&from=ops_audits`;
}

export function buildAuditsLink(requestId: string) {
  return `/app/ops/audits?q=${encodeURIComponent(requestId)}&from=ops_incidents`;
}
