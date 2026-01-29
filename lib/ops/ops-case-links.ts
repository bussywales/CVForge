import type { CaseWindow } from "@/lib/ops/ops-case-model";

type QueryValue = string | null | undefined;

function buildQuery(params: Record<string, QueryValue>) {
  const orderedKeys = ["from", "window", "tab", "status", "requestId", "userId", "email", "eventId", "surface", "signal", "code", "q"];
  const search = new URLSearchParams();
  orderedKeys.forEach((key) => {
    const value = params[key];
    if (value) search.set(key, value);
  });
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export function buildOpsCaseAlertsLink({
  window = "15m",
  requestId,
  eventId,
  from = "ops_case",
  tab = "recent",
}: {
  window?: CaseWindow;
  requestId?: string | null;
  eventId?: string | null;
  from?: string;
  tab?: "firing" | "recent";
}) {
  return `/app/ops/alerts${buildQuery({ from, window, tab, requestId, eventId })}`;
}

export function buildOpsCaseIncidentsLink({
  window = "15m",
  requestId,
  userId,
  surface,
  signal,
  code,
  from = "ops_case",
}: {
  window?: CaseWindow;
  requestId?: string | null;
  userId?: string | null;
  surface?: string | null;
  signal?: string | null;
  code?: string | null;
  from?: string;
}) {
  return `/app/ops/incidents${buildQuery({ from, window, requestId, userId, surface, signal, code })}`;
}

export function buildOpsCaseAuditsLink({
  requestId,
  userId,
  eventId,
  from = "ops_case",
}: {
  requestId?: string | null;
  userId?: string | null;
  eventId?: string | null;
  from?: string;
}) {
  return `/app/ops/audits${buildQuery({ from, requestId, userId, eventId })}`;
}

export function buildOpsCaseWebhooksLink({
  window = "15m",
  q,
  from = "ops_case",
}: {
  window?: CaseWindow;
  q?: string | null;
  from?: string;
}) {
  return `/app/ops/webhooks${buildQuery({ from, window, q })}`;
}

export function buildOpsCaseStatusLink({
  window = "15m",
  from = "ops_case",
}: {
  window?: CaseWindow;
  from?: string;
}) {
  return `/app/ops/status${buildQuery({ from, window })}#rag`;
}

export function buildOpsCaseResolutionsLink({
  from = "ops_case",
}: {
  from?: string;
}) {
  return `/app/ops/resolutions${buildQuery({ from })}`;
}
