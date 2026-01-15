import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getStripeClient } from "@/lib/stripe/stripe";
import { fetchBillingSettings } from "@/lib/data/billing";

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

  const body = await request.json().catch(() => ({} as any));
  const returnTo = typeof body?.returnTo === "string" ? body.returnTo : null;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const baseUrl = siteUrl.replace(/\/$/, "");
  const returnUrl = returnTo
    ? returnTo.startsWith("http")
      ? returnTo
      : `${baseUrl}${returnTo}`
    : `${baseUrl}/app/billing`;

  const stripe = getStripeClient();
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  if (!session.url) {
    return NextResponse.json({ error: "Unable to start portal" }, { status: 500 });
  }

  return NextResponse.json({ url: session.url });
}
