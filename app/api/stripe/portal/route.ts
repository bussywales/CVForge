import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getStripeClient } from "@/lib/stripe/stripe";
import { fetchBillingSettings } from "@/lib/data/billing";
import { logMonetisationEvent } from "@/lib/monetisation";

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

  const settings = await fetchBillingSettings(supabase, user.id);
  const customerId = settings?.stripe_customer_id;
  if (!customerId) {
    return NextResponse.json({ error: "No Stripe customer" }, { status: 400 });
  }

  const url = new URL(request.url);
  const flowParam = url.searchParams.get("flow") ?? null;
  const body = await request.json().catch(() => ({} as any));
  const flow = flowParam ?? (typeof body?.flow === "string" ? body.flow : null);
  const returnToParam = url.searchParams.get("returnTo") ?? (typeof body?.returnTo === "string" ? body.returnTo : null);
  const planParam =
    url.searchParams.get("plan") ??
    (typeof body?.plan === "string" ? body.plan : null) ??
    (typeof body?.planKey === "string" ? body.planKey : null);
  const returnTo =
    typeof body?.returnTo === "string"
      ? body.returnTo
      : typeof returnToParam === "string"
        ? returnToParam
        : null;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const baseUrl = siteUrl.replace(/\/$/, "");
  const resolvedReturn = returnTo
    ? returnTo.startsWith("http")
      ? returnTo
      : `${baseUrl}${returnTo}`
    : `${baseUrl}/app/billing`;
  const parsedReturn = new URL(resolvedReturn);
  parsedReturn.searchParams.set("portal", "1");
  if (flowParam) parsedReturn.searchParams.set("flow", flowParam);
  if (planParam) parsedReturn.searchParams.set("plan", planParam);
  const returnUrl = parsedReturn.toString();

  const stripe = getStripeClient();
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  if (!session.url) {
    try {
      await logMonetisationEvent(supabase, user.id, "sub_portal_open_failed", {
        meta: { flow },
        surface: "billing_portal",
        applicationId: null,
      });
    } catch (error) {
      console.error("[portal.log_failed]", error);
    }
    return NextResponse.json({ error: "Unable to start portal" }, { status: 500 });
  }

  try {
    await logMonetisationEvent(supabase, user.id, "sub_portal_opened", {
      meta: { flow },
      surface: "billing_portal",
      applicationId: null,
    });
  } catch (error) {
    console.error("[portal.log]", error);
  }

  return NextResponse.json({ url: session.url });
}
