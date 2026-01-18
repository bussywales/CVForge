import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { getStripeClient } from "@/lib/stripe/stripe";
import {
  getPackByPriceId,
  CREDIT_PACKS,
  resolvePriceIdForPack,
} from "@/lib/billing/packs";
import {
  getPlanByPriceId,
  SUBSCRIPTION_PLANS,
} from "@/lib/billing/plans";
import { withRequestIdHeaders, jsonError } from "@/lib/observability/request-id";
import { captureServerError } from "@/lib/observability/sentry";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { headers, requestId } = withRequestIdHeaders(request.headers);
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return jsonError({ code: "MISSING_SIGNATURE", message: "Missing webhook signature", requestId, status: 400 });
  }

  const payload = await request.text();
  const stripe = getStripeClient();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (error) {
    captureServerError(error, { requestId, route: "/api/stripe/webhook", code: "INVALID_SIGNATURE" });
    return jsonError({ code: "INVALID_SIGNATURE", message: "Invalid webhook signature", requestId, status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonError({ code: "MISSING_SERVICE_CREDS", message: "Missing Supabase service credentials", requestId });
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
    return NextResponse.json({ received: true }, { headers });
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
      { status: 500, headers }
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
      return NextResponse.json({ received: true }, { headers });
    }

    if (customerId) {
      await supabaseAdmin.from("stripe_customers").upsert(
        {
          user_id: userId,
          stripe_customer_id: customerId,
        },
        { onConflict: "user_id" }
      );
      await supabaseAdmin.from("billing_settings").upsert(
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
    const pack = getPackByPriceId(priceId);
    const plan = getPlanByPriceId(priceId);

    if (session.mode === "payment" && pack) {
      await supabaseAdmin.from("credit_ledger").insert({
        user_id: userId,
        delta: pack.credits,
        reason: "stripe.checkout",
        ref: session.id,
      });
      if (session.metadata?.application_id) {
        await supabaseAdmin.from("application_activities").insert({
          user_id: userId,
          application_id: session.metadata.application_id,
          type: "monetisation.checkout_success",
          channel: null,
          subject: "Checkout success",
          body: JSON.stringify({
            pack_key: pack.key,
            mode: "payment",
            return_to: session.metadata.return_to ?? null,
          }),
          occurred_at: new Date().toISOString(),
        });
      }
    }

    if (session.mode === "subscription" && plan) {
      const subscriptionId =
        typeof session.subscription === "string" ? session.subscription : null;
      await supabaseAdmin.from("billing_settings").upsert(
        {
          user_id: userId,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          subscription_status: "active",
          subscription_plan: plan.key,
        },
        { onConflict: "user_id" }
      );
      await supabaseAdmin.from("credit_ledger").insert({
        user_id: userId,
        delta: plan.creditsPerMonth,
        reason: "stripe.subscription",
        ref: session.id,
      });
      if (session.metadata?.application_id) {
        await supabaseAdmin.from("application_activities").insert({
          user_id: userId,
          application_id: session.metadata.application_id,
          type: "monetisation.checkout_success",
          channel: null,
          subject: "Checkout success",
          body: JSON.stringify({
            plan_key: plan.key,
            mode: "subscription",
            return_to: session.metadata.return_to ?? null,
          }),
          occurred_at: new Date().toISOString(),
        });
      }
    }
  }

  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId =
      typeof subscription.customer === "string" ? subscription.customer : null;
    let userId: string | null = null;

    if (customerId) {
      const { data: mappedCustomer } = await supabaseAdmin
        .from("stripe_customers")
        .select("user_id")
        .eq("stripe_customer_id", customerId)
        .maybeSingle();
      userId = mappedCustomer?.user_id ?? null;
    }

    if (userId && subscription.items.data[0]?.price?.id) {
      const plan = getPlanByPriceId(subscription.items.data[0].price.id);
      await supabaseAdmin.from("billing_settings").upsert(
        {
          user_id: userId,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscription.id,
          subscription_status: subscription.status,
          subscription_plan: plan?.key ?? null,
        },
        { onConflict: "user_id" }
      );
    }
  }

  if (event.type === "invoice.paid") {
    const invoice = event.data.object as Stripe.Invoice;
    const customerId =
      typeof invoice.customer === "string" ? invoice.customer : null;
    let userId: string | null = null;
    if (customerId) {
      const { data: mappedCustomer } = await supabaseAdmin
        .from("stripe_customers")
        .select("user_id")
        .eq("stripe_customer_id", customerId)
        .maybeSingle();
      userId = mappedCustomer?.user_id ?? null;
    }
    const line = invoice.lines.data[0] as any;
    const priceId = line?.price?.id ?? null;
    const plan = getPlanByPriceId(priceId ?? null);
    if (userId && plan && invoice.id) {
      const { data: existingCredit } = await supabaseAdmin
        .from("credit_ledger")
        .select("id")
        .eq("ref", invoice.id)
        .eq("reason", "stripe.subscription")
        .maybeSingle();
      if (!existingCredit) {
        await supabaseAdmin.from("credit_ledger").insert({
          user_id: userId,
          delta: plan.creditsPerMonth,
          reason: "stripe.subscription",
          ref: invoice.id,
        });
      }
    }
  }

  return NextResponse.json({ received: true }, { headers });
}
