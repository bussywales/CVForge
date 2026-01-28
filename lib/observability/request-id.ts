export function makeRequestId(existing?: string | null) {
  if (existing && existing.startsWith("req_")) return existing;
  const rand = Math.random().toString(36).slice(2, 14);
  return `req_${rand}`;
}

export function withRequestIdHeaders(headersInit?: HeadersInit, requestId?: string, opts?: { noStore?: boolean }) {
  const incoming = headersInit ? new Headers(headersInit) : null;
  const resolved = makeRequestId(requestId ?? incoming?.get("x-request-id") ?? null);
  const headers = new Headers();
  headers.set("x-request-id", resolved);
  const shouldNoStore = opts?.noStore ?? true;
  if (shouldNoStore) {
    headers.set("cache-control", "no-store");
  }
  return { headers, requestId: resolved };
}

export function applyRequestIdHeaders(res: Response, requestId: string, opts?: { noStore?: boolean; retryAfterSeconds?: number }) {
  res.headers.set("x-request-id", requestId);
  if (opts?.noStore) {
    res.headers.set("cache-control", "no-store");
  }
  if (typeof opts?.retryAfterSeconds === "number") {
    res.headers.set("retry-after", `${opts.retryAfterSeconds}`);
  }
  return res;
}

export function jsonError({
  code,
  message,
  requestId,
  status = 500,
  noStore = true,
  meta,
}: {
  code: string;
  message: string;
  requestId: string;
  status?: number;
  noStore?: boolean;
  meta?: Record<string, any>;
}) {
  const res = new Response(JSON.stringify({ error: { code, message, requestId, meta } }), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
  return applyRequestIdHeaders(res, requestId, { noStore });
}
