import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { fetchApplication } from "@/lib/data/applications";
import { insertOutcome } from "@/lib/data/outcomes";
import { OUTCOME_REASON_CODES, OUTCOME_STATUSES } from "@/lib/outcome-loop";

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
  const applicationId = body?.applicationId as string | undefined;
  const status = body?.status as string | undefined;
  const reason = body?.reason as string | undefined;
  const notes = body?.notes as string | undefined;

  if (!applicationId || !status) {
    return NextResponse.json({ error: "Missing fields." }, { status: 400 });
  }

  if (!OUTCOME_STATUSES.includes(status as (typeof OUTCOME_STATUSES)[number])) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }
  if (reason && !OUTCOME_REASON_CODES.includes(reason as (typeof OUTCOME_REASON_CODES)[number])) {
    return NextResponse.json({ error: "Invalid reason." }, { status: 400 });
  }

  const application = await fetchApplication(supabase, user.id, applicationId);
  if (!application) {
    return NextResponse.json({ error: "Application not found." }, { status: 404 });
  }

  try {
    const result = await insertOutcome(supabase, user.id, application, {
      status,
      reason,
      notes,
      happened_at: body?.happened_at ?? null,
    });

    return NextResponse.json({ ok: true, outcome: result.outcome, actionSummary: result.actionSummary });
  } catch (error) {
    console.error("[outcomes.create]", error);
    return NextResponse.json({ error: "Unable to save outcome." }, { status: 500 });
  }
}
