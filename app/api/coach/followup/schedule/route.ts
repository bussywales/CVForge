import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { nextBusinessDate } from "@/lib/coach-mode";
import { createApplicationActivity } from "@/lib/data/application-activities";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect("/login");
  }

  const { searchParams } = new URL(request.url);
  const applicationId = searchParams.get("applicationId");
  if (!applicationId) {
    return NextResponse.redirect("/app/insights?coach=missing_app");
  }

  const dueAt = nextBusinessDate(2);
  try {
    await supabase
      .from("applications")
      .update({ next_action_due: dueAt })
      .eq("id", applicationId)
      .eq("user_id", user.id);

    await createApplicationActivity(supabase, user.id, {
      application_id: applicationId,
      type: "coach.followup.scheduled",
      channel: null,
      subject: "Follow-up scheduled",
      body: `Coach scheduled follow-up for ${dueAt}`,
      occurred_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[coach.followup.schedule]", error);
    return NextResponse.redirect(
      `/app/insights?coach=error&applicationId=${applicationId}`
    );
  }

  return NextResponse.redirect(
    `/app/applications/${applicationId}?tab=activity#follow-up&coach=scheduled`
  );
}
