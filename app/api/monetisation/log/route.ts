import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import { logMonetisationEvent } from "@/lib/monetisation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const allowedEvents = [
  "gate_shown",
  "gate_blocked",
  "billing_clicked",
  "billing_viewed",
  "billing_return",
  "billing_success_banner_view",
  "billing_success_banner_resume_click",
  "billing_success_banner_dismiss",
  "resume_completed",
  "resume_next_step_click",
  "pack_recommended",
  "checkout_started",
  "checkout_redirect_failed",
  "checkout_retry_click",
  "checkout_help_open",
  "checkout_start_failed",
  "checkout_success",
  "autopack_generate_completed",
  "interview_pack_export_completed",
  "application_kit_download_completed",
  "answer_pack_generate_completed",
  "completion_watchdog_view",
  "completion_watchdog_back_click",
  "completion_watchdog_mark_done",
  "completion_watchdog_dismiss",
  "credits_idle_nudge_view",
  "credits_idle_nudge_click",
  "credits_idle_nudge_dismiss",
  "billing_sub_reco_view",
  "billing_sub_reco_click",
  "billing_sub_reco_checkout_started",
  "billing_sub_reco_checkout_failed",
  "sub_nudge_view",
  "sub_nudge_click_start",
  "sub_nudge_click_manage",
  "sub_gate_upsell_view",
  "sub_gate_upsell_click",
  "sub_post_purchase_tip_view",
  "sub_post_purchase_tip_click",
  "sub_recovery_upsell_view",
  "sub_recovery_upsell_click",
  "billing_plan_unavailable",
  "resume_banner_shown",
  "resume_clicked",
  "resume_dismissed",
  "autopack_generated",
  "billing_pack_unavailable",
] as const;

const bodySchema = z.object({
  event: z.enum(allowedEvents),
  surface: z.string().optional(),
  applicationId: z.string().uuid().optional(),
  meta: z.record(z.string(), z.any()).optional(),
});

export async function POST(request: Request) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as unknown;
  const parsed = bodySchema.safeParse(body as Record<string, unknown>);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    await logMonetisationEvent(supabase, user.id, parsed.data.event, {
      surface: parsed.data.surface ?? null,
      applicationId: parsed.data.applicationId ?? null,
      meta: parsed.data.meta ?? {},
    });
  } catch (error) {
    console.error("[monetisation.log]", error);
    return NextResponse.json({ error: "Unable to log event" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
