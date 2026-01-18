import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { fetchApplication } from "@/lib/data/applications";
import { insertOutcome } from "@/lib/data/outcomes";
import { OUTCOME_REASON_CODES, OUTCOME_STATUSES } from "@/lib/outcome-loop";
import { withRequestIdHeaders, jsonError } from "@/lib/observability/request-id";
import { captureServerError } from "@/lib/observability/sentry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { headers, requestId } = withRequestIdHeaders(request.headers);
  const respond = (body: any, status = 200) =>
    new NextResponse(JSON.stringify(body), {
      status,
      headers: new Headers({ ...Object.fromEntries(headers), "content-type": "application/json" }),
    });
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonError({ code: "UNAUTHORIZED", message: "Unauthorized", requestId, status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const applicationId = body?.applicationId as string | undefined;
  const status = body?.status as string | undefined;
  const reason = body?.reason as string | undefined;
  const notes = body?.notes as string | undefined;

  if (!applicationId || !status) {
    return jsonError({ code: "MISSING_FIELDS", message: "Missing fields.", requestId, status: 400 });
  }

  if (!OUTCOME_STATUSES.includes(status as (typeof OUTCOME_STATUSES)[number])) {
    return jsonError({ code: "INVALID_STATUS", message: "Invalid status.", requestId, status: 400 });
  }
  if (reason && !OUTCOME_REASON_CODES.includes(reason as (typeof OUTCOME_REASON_CODES)[number])) {
    return jsonError({ code: "INVALID_REASON", message: "Invalid reason.", requestId, status: 400 });
  }

  const application = await fetchApplication(supabase, user.id, applicationId);
  if (!application) {
    return jsonError({ code: "APPLICATION_NOT_FOUND", message: "Application not found.", requestId, status: 404 });
  }

  try {
    const result = await insertOutcome(supabase, user.id, application, {
      status,
      reason,
      notes,
      happened_at: body?.happened_at ?? null,
    });

    return respond({ ok: true, outcome: result.outcome, actionSummary: result.actionSummary });
  } catch (error) {
    captureServerError(error, { requestId, route: "/api/outcomes/create", userId: user.id, code: "OUTCOME_SAVE_FAILED" });
    return jsonError({ code: "OUTCOME_SAVE_FAILED", message: "Unable to save outcome.", requestId });
  }
}
