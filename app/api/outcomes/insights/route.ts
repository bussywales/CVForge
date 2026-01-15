import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { buildOutcomeInsights } from "@/lib/outcome-loop";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    });
  } catch (error) {
    console.error("[outcomes.insights]", error);
    return NextResponse.json({ error: "Unable to load insights." }, { status: 500 });
  }
}
