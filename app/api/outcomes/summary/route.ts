import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { computeOutcomeSummary } from "@/lib/data/outcomes";
import { computeActionSummaryForApplication } from "@/lib/outcome-loop";
import { withRequestIdHeaders, jsonError } from "@/lib/observability/request-id";
import { captureServerError } from "@/lib/observability/sentry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { headers, requestId } = withRequestIdHeaders(request.headers);
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonError({ code: "UNAUTHORIZED", message: "Unauthorized", requestId, status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const applicationId = searchParams.get("applicationId");
  if (!applicationId) {
    return jsonError({ code: "MISSING_APPLICATION_ID", message: "Missing applicationId.", requestId, status: 400 });
  }

  try {
    const summary = await computeOutcomeSummary(supabase, user.id, applicationId);
    const actionSummary = await computeActionSummaryForApplication(
      supabase,
      user.id,
      applicationId
    );

    const suggestedNext: Array<{ label: string; href: string }> = [];
    if (actionSummary.evidence_selected === 0) {
      suggestedNext.push({
        label: "Add evidence for gaps",
        href: `/app/applications/${applicationId}?tab=evidence#role-fit`,
      });
    }
    if (actionSummary.outreach_logged === 0) {
      suggestedNext.push({
        label: "Log outreach",
        href: `/app/applications/${applicationId}?tab=activity#followup`,
      });
    }
    if (actionSummary.practice_answers === 0) {
      suggestedNext.push({
        label: "Practise interview questions",
        href: `/app/applications/${applicationId}?tab=interview#practice-dashboard`,
      });
    }

    return NextResponse.json({
      ok: true,
      summary,
      actionSummary,
      suggestedNext,
    }, { headers });
  } catch (error) {
    captureServerError(error, { requestId, route: "/api/outcomes/summary", userId: user.id, code: "OUTCOME_SUMMARY_FAIL" });
    return jsonError({ code: "OUTCOME_SUMMARY_FAIL", message: "Unable to load outcomes.", requestId });
  }
}
