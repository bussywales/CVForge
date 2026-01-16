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

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({} as any));
  const packKey = typeof body?.packKey === "string" ? body.packKey : undefined;
  const returnTo = typeof body?.returnTo === "string" ? body.returnTo : null;
  const applicationId =
    typeof body?.applicationId === "string" ? body.applicationId : null;
  const mode = body?.mode === "subscription" ? "subscription" : "payment";
  const planKey = typeof body?.planKey === "string" ? body.planKey : undefined;
  const pack = getPackByKey(packKey) ?? CREDIT_PACKS[0];
  const priceId =
    mode === "subscription"
      ? resolvePriceIdForPlan(planKey ?? "monthly_30")
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
    return NextResponse.json(
      { error: "Missing priceId for pack", pack: pack.key },
      { status: 400 }
    );
  }

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

  const session = await stripe.checkout.sessions.create({
    mode,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: buildUrl(returnTo, "purchased"),
    cancel_url: buildUrl(returnTo, "canceled"),
    customer_email: user.email ?? undefined,
    client_reference_id: user.id,
    customer: customerId ?? undefined,
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
    return NextResponse.json(
      { error: "Unable to create checkout session" },
      { status: 500 }
    );
  }

  return NextResponse.json({ url: session.url });
}
