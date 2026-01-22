export function buildOpsIncidentsLink({
  window = "15m",
  surface,
  code,
  signal,
  from = "ops_status",
  requestId,
}: {
  window?: string;
  surface?: string | null;
  code?: string | null;
  signal?: string | null;
  from?: string;
  requestId?: string | null;
}) {
  const params = new URLSearchParams();
  if (window) params.set("window", window);
  if (surface) params.set("surface", surface);
  if (code) params.set("code", code);
  if (signal) params.set("signal", signal);
  if (requestId) params.set("requestId", requestId);
  if (from) params.set("from", from);
  return `/app/ops/incidents?${params.toString()}`;
}

export function buildOpsWebhooksLink({ window = "15m", code, signal, from = "ops_status" }: { window?: string; code?: string | null; signal?: string | null; from?: string }) {
  const params = new URLSearchParams();
  if (window) params.set("window", window);
  if (code) params.set("code", code);
  if (signal) params.set("signal", signal);
  if (from) params.set("from", from);
  return `/app/ops/webhooks?${params.toString()}`;
}
