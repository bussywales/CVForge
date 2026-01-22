import { NextResponse } from "next/server";
import { applyRequestIdHeaders, withRequestIdHeaders, jsonError } from "@/lib/observability/request-id";
import { createServerClient } from "@/lib/supabase/server";
import { getUserCredits, listCreditActivity } from "@/lib/data/credits";
import { buildBillingStatus } from "@/lib/billing/billing-status";
import { buildBillingTimeline } from "@/lib/billing/billing-timeline";
import { detectCreditDelay } from "@/lib/billing/billing-credit-delay";
import { computeWebhookHealth } from "@/lib/webhook-health";
import { fetchBillingSettings } from "@/lib/data/billing";
import { createBillingCorrelation } from "@/lib/billing/billing-correlation";
import { buildWebhookReceipt } from "@/lib/webhook-receipts";
import { buildWebhookStatusV2 } from "@/lib/webhook-status-v2";
import { buildCorrelationConfidence } from "@/lib/webhook-status-v2";
import { checkRateLimit } from "@/lib/rate-limit";
import { getRateLimitBudget } from "@/lib/rate-limit-budgets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { headers, requestId } = withRequestIdHeaders(request.headers, undefined, { noStore: true });
  const ip = (request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "").split(",")[0]?.trim() || null;
  const supabase = createServerClient();
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes.user;
  if (!user) {
    return jsonError({ code: "UNAUTHORIZED", message: "Unauthorized", requestId, status: 401 });
  }

  const budget = getRateLimitBudget("billing_recheck");
  const throttle = checkRateLimit({
    route: "billing_recheck",
    identifier: user.id ?? ip,
    limit: budget.limit,
    windowMs: budget.windowMs,
  });
  if (!throttle.allowed) {
    headers.set("retry-after", `${throttle.retryAfterSeconds}`);
    const res = jsonError({
      code: "RATE_LIMITED",
      message: "Too many refreshes. Please wait a moment.",
      requestId,
      status: 429,
      meta: { limitKey: "billing_recheck", budget: budget.budget, retryAfterSeconds: throttle.retryAfterSeconds },
    });
    return applyRequestIdHeaders(res, requestId, { noStore: true, retryAfterSeconds: throttle.retryAfterSeconds });
  }

  try {
    const now = new Date();
    const credits = await getUserCredits(supabase, user.id);
    const activity = await listCreditActivity(supabase, user.id, 50);
    const settings = await fetchBillingSettings(supabase, user.id);
    const { data: monetisationEventsRes } = await supabase
      .from("application_activities")
      .select("type, occurred_at, body")
      .eq("user_id", user.id)
      .ilike("type", "monetisation.%")
      .order("occurred_at", { ascending: false })
      .limit(100);
    const monetisationEvents = monetisationEventsRes ?? [];
    const billingStatus = buildBillingStatus({ settings, credits, activity, searchParams: null });
    const timeline = buildBillingTimeline({ events: monetisationEvents as any, ledger: activity, limit: 12 });
    const webhookReceipt = buildWebhookReceipt({ events: monetisationEvents as any, now });
    const webhookHealth = computeWebhookHealth(
      timeline.map((item) => ({ kind: item.kind as any, at: item.at, code: item.code ?? null })),
      now
    );
    const delayState = detectCreditDelay({ timeline, now });
    const correlationV2 = createBillingCorrelation({ timeline, ledger: activity, creditsAvailable: credits, now });
    const webhookStatusV2 = buildWebhookStatusV2({ timeline: timeline as any, webhookReceipt, correlation: correlationV2, delay: delayState, now });
    const correlationConfidence = buildCorrelationConfidence({ timeline: timeline as any, webhookReceipt, delay: delayState, now });

    return NextResponse.json(
      {
        ok: true,
        requestId,
        model: {
          billingStatus,
          timeline,
          webhookHealth,
          webhookReceipt,
          webhookDedupe: webhookReceipt.dedupe,
          delayState,
          correlationV2,
          delayV2: correlationV2.delay,
          webhookStatusV2,
          correlationConfidence,
        },
      },
      { headers, status: 200 }
    );
  } catch (error) {
    return jsonError({ code: "RECHECK_FAILED", message: "Unable to refresh billing status", requestId, status: 200 });
  }
}
