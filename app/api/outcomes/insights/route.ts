import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { buildOutcomeInsights } from "@/lib/outcome-loop";
import { withRequestIdHeaders, jsonError } from "@/lib/observability/request-id";
import { captureServerError } from "@/lib/observability/sentry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { headers, requestId } = withRequestIdHeaders();
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonError({ code: "UNAUTHORIZED", message: "Unauthorized", requestId, status: 401 });
  }

  try {
    const { data: outcomes, error } = await supabase
      .from("application_outcomes")
      .select("id, outcome_status")
      .eq("user_id", user.id)
      .order("happened_at", { ascending: false })
      .limit(50);
    if (error) throw error;

    const outcomeIds = outcomes?.map((o) => o.id) ?? [];
    const { data: links, error: linksError } = await supabase
      .from("outcome_action_links")
      .select("outcome_id, action_key, action_count")
      .eq("user_id", user.id)
      .in("outcome_id", outcomeIds);
    if (linksError) throw linksError;

    const insights = buildOutcomeInsights(outcomes ?? [], links ?? []);

    return NextResponse.json({
      ok: true,
      insights: insights.length ? insights : null,
      message: insights.length ? null : "Not enough outcomes yet",
    }, { headers });
  } catch (error) {
    captureServerError(error, { requestId, route: "/api/outcomes/insights", userId: user.id, code: "OUTCOME_INSIGHTS_FAIL" });
    return jsonError({ code: "OUTCOME_INSIGHTS_FAIL", message: "Unable to load insights.", requestId });
  }
}
