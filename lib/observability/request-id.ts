export function makeRequestId(existing?: string | null) {
  if (existing && existing.startsWith("req_")) return existing;
  const rand = Math.random().toString(36).slice(2, 14);
  return `req_${rand}`;
}

export function withRequestIdHeaders(headersInit?: HeadersInit, requestId?: string) {
  const headers = new Headers(headersInit ?? {});
  const resolved = makeRequestId(requestId ?? headers.get("x-request-id"));
  headers.set("x-request-id", resolved);
  return { headers, requestId: resolved };
}

export function jsonError({
  code,
  message,
  requestId,
  status = 500,
}: {
  code: string;
  message: string;
  requestId: string;
  status?: number;
}) {
  return new Response(JSON.stringify({ error: { code, message, requestId } }), {
    status,
    headers: {
      "content-type": "application/json",
      "x-request-id": requestId,
    },
  });
}
