export type SafeJsonResult<T> = {
  ok: boolean;
  status: number;
  contentType: string | null;
  json?: T;
  data?: T;
  text?: string;
};

export async function safeReadJson<T>(res: Response): Promise<SafeJsonResult<T>> {
  const contentType = res.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    try {
      const parsed = (await res.json()) as T;
      return { ok: true, status: res.status, contentType, json: parsed, data: parsed };
    } catch {
      return { ok: false, status: res.status, contentType };
    }
  }
  try {
    const text = await res.text();
    const capped = text.length > 2048 ? `${text.slice(0, 2048)}...` : text;
    return { ok: false, status: res.status, contentType, text: capped };
  } catch {
    return { ok: false, status: res.status, contentType };
  }
}

export async function fetchJsonSafe<T>(input: RequestInfo | URL, init?: RequestInit): Promise<{
  ok: boolean;
  status: number;
  requestId?: string | null;
  json?: T;
  error?: { code: string; message: string };
}> {
  const res = await fetch(input, init);
  const requestId = res.headers.get("x-request-id") ?? (init && (init as any).headers?.["x-request-id"]) ?? null;
  const parsed = await safeReadJson<T>(res);
  if (res.ok && parsed.json) {
    return { ok: true, status: res.status, requestId, json: parsed.json };
  }
  if (parsed.ok && parsed.json) {
    return { ok: true, status: res.status, requestId, json: parsed.json };
  }
  if (!parsed.contentType || !parsed.contentType.includes("application/json")) {
    return { ok: false, status: res.status, requestId, error: { code: "NON_JSON_RESPONSE", message: "Unexpected response format" } };
  }
  if (!parsed.json) {
    return { ok: false, status: res.status, requestId, error: { code: "JSON_PARSE_ERROR", message: "Unable to parse response" } };
  }
  const errBody: any = parsed.json;
  return {
    ok: false,
    status: res.status,
    requestId,
    error: {
      code: errBody?.error?.code ?? errBody?.code ?? "HTTP_ERROR",
      message: errBody?.error?.message ?? errBody?.message ?? "Request failed",
    },
  };
}
