import { NextResponse } from "next/server";
import { getSupabaseUser } from "@/lib/data/supabase";
import { getUserCredits, listCreditActivity } from "@/lib/data/credits";
import { fetchBillingSettings } from "@/lib/data/billing";
import { withRequestIdHeaders, jsonError } from "@/lib/observability/request-id";
import { getUserRole, isAdminRole } from "@/lib/rbac";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { getStripeClient } from "@/lib/stripe/stripe";
import { captureServerError } from "@/lib/observability/sentry";
import { buildBillingStatus } from "@/lib/billing/billing-status";
import { mapStripePriceToPlanKey } from "@/lib/ops/stripe-price-map";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function maskEmail(email: string | null | undefined) {
  if (!email) return null;
  const [local, domain] = email.split("@");
  if (!domain) return null;
  const maskedLocal = local.length <= 1 ? "*" : `${local[0]}***`;
  const domainParts = domain.split(".");
  const maskedDomain = domainParts
    .map((part, idx) => (idx === domainParts.length - 1 ? part : `${part[0] ?? ""}${"*".repeat(Math.max(0, part.length - 1))}`))
    .join(".");
  return `${maskedLocal}@${maskedDomain}`;
}

function maskId(id: string | null | undefined) {
  if (!id) return null;
  if (id.length <= 6) return `${id[0] ?? ""}***`;
  return `${id.slice(0, 4)}***${id.slice(-2)}`;
}

export async function GET(request: Request) {
  const { headers, requestId } = withRequestIdHeaders(request.headers);
  headers.set("cache-control", "no-store");
  const { user } = await getSupabaseUser();
  if (!user) {
    return jsonError({ code: "UNAUTHORIZED", message: "Unauthorized", requestId, status: 401 });
  }
  const roleInfo = await getUserRole(user.id);
  if (!isAdminRole(roleInfo.role)) {
    return jsonError({ code: "FORBIDDEN", message: "Insufficient role", requestId, status: 403 });
  }

  const url = new URL(request.url);
  const targetUserId = url.searchParams.get("userId");
  if (!targetUserId || targetUserId.length < 6) {
    return jsonError({ code: "INVALID_USER", message: "userId required", requestId, status: 400 });
  }

  const admin = createServiceRoleClient();
  const authUser = await admin.auth.admin.getUserById(targetUserId).catch(() => null);
  const emailMasked = maskEmail(authUser?.data?.user?.email);

  try {
    const settings = await fetchBillingSettings(admin as any, targetUserId);
    const credits = await getUserCredits(admin as any, targetUserId).catch(() => 0);
    const ledger = await listCreditActivity(admin as any, targetUserId, 50).catch(() => []);
    const local = buildBillingStatus({ settings, credits, activity: ledger, searchParams: null });

    const stripeCustomerId = settings?.stripe_customer_id ?? null;
    const stripeSubscriptionId = settings?.stripe_subscription_id ?? null;
    const stripeSnapshot: {
      customerIdMasked: string | null;
      hasCustomer: boolean;
      hasSubscription: boolean;
      subscriptionStatus: "active" | "trialing" | "past_due" | "canceled" | "incomplete" | "none";
      cancelAtPeriodEnd?: boolean;
      currentPeriodEnd?: string;
      priceKey?: string | null;
      latestInvoiceStatus?: string | null;
      lastPaymentErrorCode?: string | null;
    } = {
      customerIdMasked: maskId(stripeCustomerId),
      hasCustomer: Boolean(stripeCustomerId),
      hasSubscription: false,
      subscriptionStatus: "none",
      cancelAtPeriodEnd: undefined,
      currentPeriodEnd: undefined,
      priceKey: null,
      latestInvoiceStatus: null,
      lastPaymentErrorCode: null,
    };

    if (stripeCustomerId) {
      try {
        const stripe = getStripeClient();
        let subscription: any = null;
        if (stripeSubscriptionId) {
          subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId).catch(() => null);
        }
        if (!subscription) {
          const subs = await stripe.subscriptions.list({ customer: stripeCustomerId, status: "all", limit: 1 });
          subscription = subs.data?.[0] ?? null;
        }

        if (subscription) {
          stripeSnapshot.hasSubscription = true;
          const status = (subscription.status ?? "none").toLowerCase();
          stripeSnapshot.subscriptionStatus =
            status === "active" || status === "trialing" || status === "past_due" || status === "canceled" || status === "incomplete"
              ? status
              : "none";
          stripeSnapshot.cancelAtPeriodEnd = Boolean(subscription.cancel_at_period_end ?? false);
          stripeSnapshot.currentPeriodEnd = subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : undefined;
          const priceId: string | null = subscription.items?.data?.[0]?.price?.id ?? null;
          stripeSnapshot.priceKey = mapStripePriceToPlanKey(priceId);
          if (subscription.latest_invoice) {
            if (typeof subscription.latest_invoice === "string") {
              const invoice = (await stripe.invoices.retrieve(subscription.latest_invoice as any).catch(() => null)) as any;
              if (invoice) {
                stripeSnapshot.latestInvoiceStatus = invoice.status ?? null;
                const lastError = (invoice.payment_intent as any)?.last_payment_error?.code ?? invoice.last_finalization_error?.code ?? null;
                stripeSnapshot.lastPaymentErrorCode = lastError ?? null;
              }
            } else {
              const invoice = subscription.latest_invoice as any;
              stripeSnapshot.latestInvoiceStatus = invoice.status ?? null;
              const lastError = (invoice.payment_intent as any)?.last_payment_error?.code ?? invoice.last_finalization_error?.code ?? null;
              stripeSnapshot.lastPaymentErrorCode = lastError ?? null;
            }
          }
        }
      } catch (error) {
        captureServerError(error, { requestId, route: "/api/ops/billing/snapshot", userId: user.id, code: "STRIPE_SNAPSHOT_FAILED" });
        return jsonError({ code: "STRIPE_SNAPSHOT_FAILED", message: "Unable to fetch Stripe snapshot", requestId, status: 200 });
      }
    }

    const response = {
      ok: true,
      requestId,
      user: { id: targetUserId, emailMasked },
      local,
      stripe: stripeSnapshot,
    };

    return NextResponse.json(response, { headers, status: 200 });
  } catch (error) {
    captureServerError(error, { requestId, route: "/api/ops/billing/snapshot", userId: user.id, code: "SNAPSHOT_FAIL" });
    return jsonError({ code: "SNAPSHOT_FAIL", message: "Unable to build snapshot", requestId });
  }
}
