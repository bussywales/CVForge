import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getStripeClient } from "@/lib/stripe/stripe";
import {
  CREDIT_PACKS,
  getPackByKey,
  resolvePriceIdForPack,
} from "@/lib/billing/packs";
import {
  getPlanByKey,
  resolvePriceIdForPlan,
} from "@/lib/billing/plans";
import { fetchBillingSettings, upsertBillingSettings } from "@/lib/data/billing";
import { withRequestIdHeaders, jsonError } from "@/lib/observability/request-id";
import { captureServerError } from "@/lib/observability/sentry";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { headers, requestId } = withRequestIdHeaders(request.headers);
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonError({ code: "UNAUTHORIZED", message: "Unauthorized", requestId, status: 401 });
  }

  const body = await request.json().catch(() => ({} as any));
  const packKey = typeof body?.packKey === "string" ? body.packKey : undefined;
  const returnTo = typeof body?.returnTo === "string" ? body.returnTo : null;
  const applicationId =
    typeof body?.applicationId === "string" ? body.applicationId : null;
  const rawMode = typeof body?.mode === "string" ? body.mode : null;
  const mode =
    rawMode === "subscription"
      ? "subscription"
      : rawMode === "payment" || rawMode === null
        ? "payment"
        : null;
  const planKey = typeof body?.planKey === "string" ? body.planKey : undefined;
  const pack = getPackByKey(packKey) ?? CREDIT_PACKS[0];
  const plan = getPlanByKey(planKey ?? "monthly_30");
  const planKeyResolved = plan?.key ?? planKey ?? "monthly_30";

  if (!mode) {
    return jsonError({ code: "INVALID_MODE", message: "INVALID_MODE", requestId, status: 400 });
  }

  const priceId =
    mode === "subscription"
      ? resolvePriceIdForPlan(planKeyResolved)
      : resolvePriceIdForPack(pack.key);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const baseUrl = siteUrl.replace(/\/$/, "");
  const buildUrl = (target: string | null, param: string) => {
    const url =
      target && (target.startsWith("http://") || target.startsWith("https://"))
        ? new URL(target)
        : new URL(target ?? "/app/billing", baseUrl);
    url.searchParams.set(param, "1");
    return url.toString();
  };

  if (!priceId) {
    return jsonError({
      code: mode === "subscription" ? "MISSING_SUBSCRIPTION_PRICE_ID" : "MISSING_PRICE_ID",
      message: mode === "subscription" ? "Missing subscription price id" : "Missing price id",
      requestId,
      status: 400,
    });
  }

  try {
    const stripe = getStripeClient();

    let customerId: string | null = null;
    if (mode === "subscription") {
      const existing = await fetchBillingSettings(supabase, user.id);
      customerId = existing?.stripe_customer_id ?? null;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email ?? undefined,
          metadata: { user_id: user.id },
        });
        customerId = customer.id;
        await upsertBillingSettings(supabase, user.id, {
          stripe_customer_id: customerId,
        });
      }
    }

    const successUrl = new URL(buildUrl(returnTo, "purchased"));
    successUrl.searchParams.set("mode", mode);
    if (mode === "subscription") {
      successUrl.searchParams.set("sub", "1");
    }

    const cancelUrl = new URL(buildUrl(returnTo, "canceled"));
    cancelUrl.searchParams.set("mode", mode);

    const customerArgs =
      mode === "subscription" && customerId
        ? { customer: customerId }
        : { customer_email: user.email ?? undefined };

    const session = await stripe.checkout.sessions.create({
      mode,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl.toString(),
      cancel_url: cancelUrl.toString(),
      client_reference_id: user.id,
      ...customerArgs,
      metadata: {
        user_id: user.id,
        pack_key: pack.key,
        plan_key: planKey ?? null,
        mode,
        application_id: applicationId,
        return_to: returnTo ?? undefined,
      },
    });

    if (!session.url) {
      captureServerError(new Error("Missing session url"), { requestId, route: "/api/stripe/checkout", userId: user.id, code: "CHECKOUT_SESSION_MISSING" });
      return jsonError({ code: "CHECKOUT_SESSION_MISSING", message: "Unable to create checkout session", requestId });
    }

    return NextResponse.json({ url: session.url }, { headers });
  } catch (error) {
    captureServerError(error, { requestId, route: "/api/stripe/checkout", userId: user.id, code: "CHECKOUT_ERROR" });
    return jsonError({ code: "CHECKOUT_ERROR", message: "Unable to start checkout", requestId });
  }
}
