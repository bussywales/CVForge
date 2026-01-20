export type WebhookHealth = {
  status: "healthy" | "delayed" | "degraded" | "unknown";
  lastOkAt: string | null;
  lastErrorAt?: string | null;
  lastErrorCode?: string | null;
  lagSeconds?: number | null;
  window: {
    hours24: { ok: number; error: number };
    days7: { ok: number; error: number };
  };
};

type Event = {
  kind: "webhook_received" | "webhook_error" | "checkout_success" | "credits_applied" | "portal_error" | "checkout_error" | "info";
  at: string;
  code?: string | null;
};

function within(at: string, now: Date, hours: number) {
  const ts = new Date(at);
  if (Number.isNaN(ts.getTime())) return false;
  return (now.getTime() - ts.getTime()) / (1000 * 60 * 60) <= hours;
}

export function computeWebhookHealth(events: Event[], now = new Date()): WebhookHealth {
  const sorted = [...events].sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""));
  const windowCounts = {
    hours24: { ok: 0, error: 0 },
    days7: { ok: 0, error: 0 },
  };
  let lastOk: string | null = null;
  let lastError: { at?: string | null; code?: string | null } | null = null;

  sorted.forEach((evt) => {
    const isOk = evt.kind === "webhook_received" || evt.kind === "credits_applied" || evt.kind === "checkout_success";
    const isError = evt.kind === "webhook_error" || evt.kind === "portal_error" || evt.kind === "checkout_error";
    if (within(evt.at, now, 24)) {
      if (isOk) windowCounts.hours24.ok += 1;
      if (isError) windowCounts.hours24.error += 1;
    }
    if (within(evt.at, now, 24 * 7)) {
      if (isOk) windowCounts.days7.ok += 1;
      if (isError) windowCounts.days7.error += 1;
    }
    if (isOk && !lastOk) lastOk = evt.at;
    if (isError && !lastError) lastError = { at: evt.at, code: evt.code };
  });

  const lastOkTs = lastOk ? new Date(lastOk).getTime() : null;
  const lagSeconds = lastOkTs ? Math.max(0, Math.round((now.getTime() - lastOkTs) / 1000)) : null;

  const lastErrorTs = lastError ? new Date((lastError as any).at).getTime() : null;
  const hasRecentError = lastErrorTs !== null ? !lastOk || lastErrorTs > (lastOkTs ?? 0) : false;
  let status: WebhookHealth["status"] = "unknown";
  if (hasRecentError) {
    status = "degraded";
  } else if (lastOk) {
    status = lagSeconds !== null && lagSeconds > 15 * 60 ? "delayed" : "healthy";
  }

  const lastErrorAt = lastError ? (lastError as any).at ?? null : null;
  const lastErrorCode = lastError ? (lastError as any).code ?? null : null;

  return {
    status,
    lastOkAt: lastOk,
    lastErrorAt,
    lastErrorCode,
    lagSeconds,
    window: windowCounts,
  };
}
