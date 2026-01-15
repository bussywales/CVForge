import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const outcomeId = body?.outcomeId as string | undefined;
  const applicationId = body?.applicationId as string | undefined;
  const actionKey = body?.actionType as string | undefined;
  const actionCount = Number(body?.actionCount ?? 1);

  if (!outcomeId || !applicationId || !actionKey) {
    return NextResponse.json({ error: "Missing fields." }, { status: 400 });
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

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[outcomes.link-action]", error);
    return NextResponse.json({ error: "Unable to link action." }, { status: 500 });
  }
}
