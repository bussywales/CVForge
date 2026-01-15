import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { computeOutcomeSummary } from "@/lib/data/outcomes";
import { computeActionSummaryForApplication } from "@/lib/outcome-loop";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const applicationId = searchParams.get("applicationId");
  if (!applicationId) {
    return NextResponse.json({ error: "Missing applicationId." }, { status: 400 });
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
    });
  } catch (error) {
    console.error("[outcomes.summary]", error);
    return NextResponse.json({ error: "Unable to load outcomes." }, { status: 500 });
  }
}
