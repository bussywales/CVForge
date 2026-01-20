import { NextResponse } from "next/server";
import { logMonetisationEvent, type MonetisationEventName } from "@/lib/monetisation";
import { captureServerError } from "@/lib/observability/sentry";
import { sanitizeMonetisationMeta } from "@/lib/monetisation-guardrails";

export async function processMonetisationLog({
  supabase,
  userId,
  parsed,
  requestId,
  headers,
}: {
  supabase: any;
  userId: string;
  parsed: { event: MonetisationEventName; surface?: string | null; applicationId?: string | null; meta?: Record<string, any> };
  requestId: string;
  headers: Headers;
}) {
  try {
    await logMonetisationEvent(supabase, userId, parsed.event, {
      surface: parsed.surface ?? null,
      applicationId: parsed.applicationId ?? null,
      meta: sanitizeMonetisationMeta(parsed.meta),
    });
    return NextResponse.json({ ok: true }, { headers });
  } catch (error) {
    captureServerError(error, { requestId, route: "/api/monetisation/log", userId, code: "LOG_FAIL" });
    return NextResponse.json(
      { ok: false, error: { code: "LOG_FAIL", message: "Unable to log event", requestId } },
      { headers, status: 200 }
    );
  }
}
