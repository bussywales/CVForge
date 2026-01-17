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
  "checkout_try_again",
  "checkout_open_new_tab",
  "checkout_help_open",
  "checkout_help_click",
  "checkout_start_failed",
  "checkout_return_view",
  "checkout_return_dismiss",
  "checkout_cancel_view",
  "checkout_failed_view",
  "checkout_redirect_blocked",
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
  "sub_home_view",
  "sub_home_cta_click",
  "sub_low_activity_view",
  "sub_low_activity_dismiss",
  "sub_save_offer_open",
  "sub_save_offer_choose_plan",
  "sub_save_offer_keep",
  "sub_save_offer_go_to_stripe",
  "sub_post_purchase_tip_view",
  "sub_post_purchase_tip_click",
  "sub_recovery_upsell_view",
  "sub_recovery_upsell_click",
  "sub_gate_view",
  "sub_gate_click_subscribe",
  "sub_gate_not_now",
  "sub_gate_checkout_start_failed",
  "sub_gate_plan_unavailable",
  "sub_selector_view",
  "sub_selector_change_plan",
  "sub_selector_start_checkout",
  "sub_selector_plan_unavailable",
  "sub_selector_manage_portal_click",
  "sub_reco_reason_impression",
  "sub_manage_view",
  "sub_upgrade_click",
  "sub_downgrade_click",
  "sub_portal_opened",
  "sub_portal_open_failed",
  "sub_change_returned",
  "weekly_coach_view",
  "weekly_coach_action_click",
  "weekly_coach_action_log",
  "weekly_coach_targets_view",
  "weekly_coach_mark_done",
  "weekly_coach_undo",
  "weekly_coach_week_complete_view",
  "weekly_coach_add_one_more",
  "weekly_coach_leave_it",
  "weekly_review_view",
  "weekly_review_log_outcomes_click",
  "weekly_review_not_now",
  "weekly_streak_view",
  "weekly_review_examples_open",
  "weekly_review_example_click",
  "weekly_review_outcome_inline_open",
  "weekly_review_outcome_inline_save_success",
  "weekly_review_outcome_inline_save_fail",
  "streak_saver_view",
  "streak_saver_dismiss",
  "streak_saver_cta_click",
  "streak_saver_billing_banner_view",
  "streak_saver_billing_banner_dismiss",
  "streak_saver_plan_selected",
  "streak_saver_checkout_start",
  "streak_saver_checkout_start_failed",
  "streak_saver_checkout_return",
  "streak_saver_sub_active_detected",
  "intent_tile_view",
  "intent_tile_click_plan",
  "intent_tile_dismiss",
  "intent_tile_expand_why",
  "intent_billing_banner_view",
  "intent_billing_banner_dismiss",
  "sub_post_purchase_view",
  "sub_post_purchase_auto_redirect",
  "sub_post_purchase_resume_click",
  "sub_post_purchase_not_now",
  "sub_completion_nudge_view",
  "sub_completion_nudge_completed",
  "sub_completion_nudge_dismiss",
  "billing_compare_view",
  "billing_compare_choice_subscribe",
  "billing_compare_choice_topup",
  "gate_compare_view",
  "gate_compare_choice_subscribe",
  "gate_compare_choice_topup",
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
