import { NextResponse } from "next/server";
import { withRequestIdHeaders, jsonError } from "@/lib/observability/request-id";
import { createServerClient } from "@/lib/supabase/server";
import { getUserCredits, listCreditActivity } from "@/lib/data/credits";
import { buildBillingStatus } from "@/lib/billing/billing-status";
import { buildBillingTimeline } from "@/lib/billing/billing-timeline";
import { detectCreditDelay } from "@/lib/billing/billing-credit-delay";
import { computeWebhookHealth } from "@/lib/webhook-health";
import { fetchBillingSettings } from "@/lib/data/billing";
import { createBillingCorrelation } from "@/lib/billing/billing-correlation";
import { checkRecheckThrottle } from "@/lib/billing/recheck-throttle";
import { buildWebhookReceipt } from "@/lib/webhook-receipts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { headers, requestId } = withRequestIdHeaders(request.headers);
  headers.set("cache-control", "no-store");
  const ip = (request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "").split(",")[0]?.trim() || null;
  const supabase = createServerClient();
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes.user;
  if (!user) {
    const res = jsonError({ code: "UNAUTHORIZED", message: "Unauthorized", requestId, status: 401 });
    res.headers.set("cache-control", "no-store");
    return res;
  }

  const throttle = checkRecheckThrottle(user.id, ip);
  if (!throttle.allowed) {
    headers.set("retry-after", `${throttle.retryAfterSec}`);
    headers.set("cache-control", "no-store");
    const res = jsonError({ code: "RATE_LIMITED", message: "Too many refreshes. Please wait a moment.", requestId, status: 429 });
    res.headers.set("retry-after", `${throttle.retryAfterSec}`);
    res.headers.set("cache-control", "no-store");
    return res;
  }

  try {
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
    const webhookReceipt = buildWebhookReceipt({ events: monetisationEvents as any, now: new Date() });
    const webhookHealth = computeWebhookHealth(
      timeline.map((item) => ({ kind: item.kind as any, at: item.at, code: item.code ?? null })),
      new Date()
    );
    const delayState = detectCreditDelay({ timeline, now: new Date() });
    const correlationV2 = createBillingCorrelation({ timeline, ledger: activity, creditsAvailable: credits, now: new Date() });

    return NextResponse.json(
      {
        ok: true,
        requestId,
        model: { billingStatus, timeline, webhookHealth, webhookReceipt, webhookDedupe: webhookReceipt.dedupe, delayState, correlationV2, delayV2: correlationV2.delay },
      },
      { headers, status: 200 }
    );
  } catch (error) {
    const res = jsonError({ code: "RECHECK_FAILED", message: "Unable to refresh billing status", requestId, status: 200 });
    res.headers.set("cache-control", "no-store");
    return res;
  }
}
