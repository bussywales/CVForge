import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getStripeClient } from "@/lib/stripe/stripe";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const priceId = process.env.STRIPE_CREDITS_PRICE_ID;

  if (!priceId) {
    return NextResponse.json({ error: "Missing priceId" }, { status: 400 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const baseUrl = siteUrl.replace(/\/$/, "");

  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${baseUrl}/app/billing?success=1`,
    cancel_url: `${baseUrl}/app/billing?canceled=1`,
    customer_email: user.email ?? undefined,
    client_reference_id: user.id,
    metadata: {
      user_id: user.id,
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
