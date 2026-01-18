import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { withRequestIdHeaders, jsonError } from "@/lib/observability/request-id";
import { captureServerError } from "@/lib/observability/sentry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { headers, requestId } = withRequestIdHeaders(request.headers);
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonError({ code: "UNAUTHORIZED", message: "Unauthorized", requestId, status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const outcomeId = body?.outcomeId as string | undefined;
  const applicationId = body?.applicationId as string | undefined;
  const actionKey = body?.actionType as string | undefined;
  const actionCount = Number(body?.actionCount ?? 1);

  if (!outcomeId || !applicationId || !actionKey) {
    return jsonError({ code: "MISSING_FIELDS", message: "Missing fields.", requestId, status: 400 });
  }

  try {
    const { error } = await supabase.from("outcome_action_links").insert({
      user_id: user.id,
      application_id: applicationId,
      outcome_id: outcomeId,
      action_key: actionKey,
      action_count: Number.isFinite(actionCount) ? actionCount : 1,
    });
    if (error) throw error;

    return NextResponse.json({ ok: true }, { headers });
  } catch (error) {
    captureServerError(error, { requestId, route: "/api/outcomes/link-action", userId: user.id, code: "OUTCOME_LINK_FAIL" });
    return jsonError({ code: "OUTCOME_LINK_FAIL", message: "Unable to link action.", requestId });
  }
}
