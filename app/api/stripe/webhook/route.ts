import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { getStripeClient } from "@/lib/stripe/stripe";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Missing webhook signature" }, { status: 400 });
  }

  const payload = await request.text();
  const stripe = getStripeClient();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (error) {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Missing Supabase service credentials" },
      { status: 500 }
    );
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data: existingEvent } = await supabaseAdmin
    .from("stripe_events")
    .select("id")
    .eq("id", event.id)
    .maybeSingle();

  if (existingEvent) {
    return NextResponse.json({ received: true });
  }

  const { error: insertError } = await supabaseAdmin
    .from("stripe_events")
    .insert({ id: event.id, type: event.type });

  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json({ received: true });
    }
    return NextResponse.json(
      { error: "Failed to record webhook event" },
      { status: 500 }
    );
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const customerId =
      typeof session.customer === "string" ? session.customer : null;

    let userId = session.client_reference_id ?? null;

    if (!userId && customerId) {
      const { data: mappedCustomer } = await supabaseAdmin
        .from("stripe_customers")
        .select("user_id")
        .eq("stripe_customer_id", customerId)
        .maybeSingle();

      userId = mappedCustomer?.user_id ?? null;
    }

    if (!userId) {
      console.warn("[stripe webhook] missing user mapping", {
        sessionId: session.id,
      });
      return NextResponse.json({ received: true });
    }

    if (customerId) {
      await supabaseAdmin.from("stripe_customers").upsert(
        {
          user_id: userId,
          stripe_customer_id: customerId,
        },
        { onConflict: "user_id" }
      );
    }

    const lineItems = await stripe.checkout.sessions.listLineItems(
      session.id,
      { limit: 10 }
    );
    const priceId = lineItems.data[0]?.price?.id ?? null;
    const creditsPriceId = process.env.STRIPE_CREDITS_PRICE_ID ?? null;

    if (priceId && creditsPriceId && priceId === creditsPriceId) {
      await supabaseAdmin.from("credit_ledger").insert({
        user_id: userId,
        delta: 10,
        reason: "stripe.checkout",
        ref: session.id,
      });
    } else {
      console.warn("[stripe webhook] unknown price id", {
        sessionId: session.id,
        priceId,
      });
    }
  }

  return NextResponse.json({ received: true });
}
