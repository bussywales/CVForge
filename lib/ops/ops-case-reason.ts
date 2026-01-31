export type CaseReasonCode =
  | "ALERT_FIRING"
  | "ALERT_RECENT"
  | "WEBHOOK_FAILURE"
  | "BILLING_RECHECK"
  | "PORTAL_ERROR"
  | "RATE_LIMIT"
  | "TRAINING"
  | "MANUAL"
  | "UNKNOWN";

export type CaseReasonSource = {
  code: CaseReasonCode;
  title: string;
  detail: string | null;
  primarySource: string;
  count: number;
  lastSeenAt: string;
};

export type CaseReason = {
  code: CaseReasonCode;
  title: string;
  detail: string;
  primarySource: string;
  computedAt: string;
};

const CASE_REASON_TITLES: Record<CaseReasonCode, string> = {
  ALERT_FIRING: "Alert firing",
  ALERT_RECENT: "Recent alert",
  WEBHOOK_FAILURE: "Webhook failure",
  BILLING_RECHECK: "Billing recheck",
  PORTAL_ERROR: "Portal error",
  RATE_LIMIT: "Rate limit",
  TRAINING: "Training scenario",
  MANUAL: "Manual update",
  UNKNOWN: "Unknown",
};

export const CASE_REASON_PRECEDENCE: CaseReasonCode[] = [
  "ALERT_FIRING",
  "WEBHOOK_FAILURE",
  "BILLING_RECHECK",
  "RATE_LIMIT",
  "PORTAL_ERROR",
  "ALERT_RECENT",
  "TRAINING",
  "MANUAL",
  "UNKNOWN",
];

function formatWindow(windowLabel?: string | null) {
  if (!windowLabel) return "";
  return ` in last ${windowLabel}`;
}

function buildReasonDetail(code: CaseReasonCode, count: number, windowLabel?: string | null, detailOverride?: string | null) {
  if (detailOverride) return detailOverride;
  const suffix = formatWindow(windowLabel);
  switch (code) {
    case "WEBHOOK_FAILURE":
      return `Webhook failures: ${count}${suffix}`;
    case "BILLING_RECHECK":
      return `Billing recheck activity: ${count}${suffix}`;
    case "PORTAL_ERROR":
      return `Portal errors: ${count}${suffix}`;
    case "RATE_LIMIT":
      return `Rate limit hits: ${count}${suffix}`;
    case "ALERT_FIRING":
      return "Alert firing";
    case "ALERT_RECENT":
      return `Alert activity${suffix}`;
    case "TRAINING":
      return `Training scenario${suffix}`;
    case "MANUAL":
      return "Manual case update";
    case "UNKNOWN":
    default:
      return "No recent signals";
  }
}

export function normaliseCaseReasonCode(value?: string | null): CaseReasonCode | null {
  if (!value) return null;
  return CASE_REASON_PRECEDENCE.includes(value as CaseReasonCode) ? (value as CaseReasonCode) : null;
}

export function coerceCaseReasonSources(input: unknown): CaseReasonSource[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const raw = item as Record<string, any>;
      const code = normaliseCaseReasonCode(typeof raw.code === "string" ? raw.code : null);
      if (!code) return null;
      const lastSeenAt = typeof raw.lastSeenAt === "string" ? raw.lastSeenAt : null;
      if (!lastSeenAt || Number.isNaN(Date.parse(lastSeenAt))) return null;
      const count = typeof raw.count === "number" && raw.count > 0 ? raw.count : 1;
      const title = typeof raw.title === "string" && raw.title.trim() ? raw.title : CASE_REASON_TITLES[code];
      const detail = typeof raw.detail === "string" ? raw.detail : null;
      const primarySource = typeof raw.primarySource === "string" && raw.primarySource.trim() ? raw.primarySource : "unknown";
      return { code, title, detail, primarySource, count, lastSeenAt };
    })
    .filter(Boolean) as CaseReasonSource[];
}

export function buildCaseReasonSource({
  code,
  count,
  lastSeenAt,
  primarySource,
  detail,
  windowLabel,
}: {
  code: CaseReasonCode;
  count: number;
  lastSeenAt: string;
  primarySource: string;
  detail?: string | null;
  windowLabel?: string | null;
}): CaseReasonSource {
  const title = CASE_REASON_TITLES[code];
  return {
    code,
    title,
    detail: buildReasonDetail(code, count, windowLabel, detail ?? null),
    primarySource,
    count: Math.max(1, count),
    lastSeenAt,
  };
}

export function mergeCaseReasonSources(sources: CaseReasonSource[]) {
  const merged = new Map<string, CaseReasonSource>();
  sources.forEach((source) => {
    const key = `${source.code}:${source.primarySource}`;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, { ...source });
      return;
    }
    const lastSeenAt = new Date(source.lastSeenAt).getTime() >= new Date(existing.lastSeenAt).getTime()
      ? source.lastSeenAt
      : existing.lastSeenAt;
    merged.set(key, {
      ...existing,
      count: existing.count + source.count,
      lastSeenAt,
      detail: source.detail ?? existing.detail,
      primarySource: source.primarySource || existing.primarySource,
    });
  });
  return Array.from(merged.values()).sort((a, b) => {
    const aTime = new Date(a.lastSeenAt).getTime();
    const bTime = new Date(b.lastSeenAt).getTime();
    return bTime - aTime;
  });
}

export function resolveCaseReason({
  sources,
  windowFromIso,
  windowLabel,
  now = new Date(),
}: {
  sources: CaseReasonSource[];
  windowFromIso?: string | null;
  windowLabel?: string | null;
  now?: Date;
}): { reason: CaseReason; sources: CaseReasonSource[] } {
  const merged = mergeCaseReasonSources(sources);
  const fromMs = windowFromIso ? new Date(windowFromIso).getTime() : Number.NaN;
  const active =
    Number.isNaN(fromMs) || !windowFromIso
      ? merged
      : merged.filter((source) => new Date(source.lastSeenAt).getTime() >= fromMs);
  if (!Number.isNaN(fromMs) && windowFromIso && active.length === 0) {
    return {
      reason: {
        code: "UNKNOWN",
        title: CASE_REASON_TITLES.UNKNOWN,
        detail: buildReasonDetail("UNKNOWN", 0, windowLabel, null),
        primarySource: "unknown",
        computedAt: now.toISOString(),
      },
      sources: merged,
    };
  }
  const candidates = active.length ? active : merged;
  let reasonSource: CaseReasonSource | null = null;
  for (const code of CASE_REASON_PRECEDENCE) {
    const match = candidates.find((source) => source.code === code);
    if (match) {
      reasonSource = match;
      break;
    }
  }
  const nowIso = now.toISOString();
  if (!reasonSource) {
    const title = CASE_REASON_TITLES.UNKNOWN;
    return {
      reason: {
        code: "UNKNOWN",
        title,
        detail: buildReasonDetail("UNKNOWN", 0, windowLabel, null),
        primarySource: "unknown",
        computedAt: nowIso,
      },
      sources: merged,
    };
  }
  const detail = buildReasonDetail(reasonSource.code, reasonSource.count, windowLabel, reasonSource.detail ?? null);
  return {
    reason: {
      code: reasonSource.code,
      title: CASE_REASON_TITLES[reasonSource.code],
      detail,
      primarySource: reasonSource.primarySource,
      computedAt: nowIso,
    },
    sources: merged,
  };
}
