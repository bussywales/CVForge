"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ErrorBanner from "@/components/ErrorBanner";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";
import { deriveBillingTriageNextStep } from "@/lib/ops/ops-billing-triage";
import type { BillingStatusSnapshot } from "@/lib/billing/billing-status";
import { OPS_BILLING_COPY } from "@/lib/ops/ops-billing.microcopy";

type SnapshotResponse =
  | {
      ok: true;
      requestId: string;
      user: { id: string; emailMasked: string | null };
      local: BillingStatusSnapshot;
      stripe: {
        customerIdMasked: string | null;
        hasCustomer: boolean;
        hasSubscription: boolean;
        subscriptionStatus: "active" | "trialing" | "past_due" | "canceled" | "incomplete" | "none";
        cancelAtPeriodEnd?: boolean;
        currentPeriodEnd?: string | null;
        priceKey?: string | null;
        latestInvoiceStatus?: string | null;
        lastPaymentErrorCode?: string | null;
      };
    }
  | {
      ok: false;
      error: { code: string; message: string; requestId: string };
    };

type Props = {
  userId: string;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
};

export default function BillingTriageCard({ userId, stripeCustomerId, stripeSubscriptionId }: Props) {
  const [snapshot, setSnapshot] = useState<SnapshotResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const nextStep = useMemo(() => {
    if (!snapshot || !snapshot.ok) return null;
    return deriveBillingTriageNextStep({
      local: snapshot.local,
      stripe: snapshot.stripe,
    });
  }, [snapshot]);

  const fetchSnapshot = async (source: "view" | "refresh") => {
    if (loading) return;
    if (source === "refresh") {
      logMonetisationClientEvent("ops_billing_snapshot_refresh_click", null, "ops", { userId });
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/ops/billing/snapshot?userId=${encodeURIComponent(userId)}`, { method: "GET", cache: "no-store" });
      const body = (await res.json()) as SnapshotResponse;
      setSnapshot(body);
      if (body.ok) {
        if (source === "view") {
          logMonetisationClientEvent("ops_billing_snapshot_view", null, "ops", { userId, requestId: body.requestId });
        } else {
          logMonetisationClientEvent("ops_billing_snapshot_refresh_ok", null, "ops", { userId, requestId: body.requestId });
        }
      } else {
        logMonetisationClientEvent("ops_billing_snapshot_refresh_error", null, "ops", { userId, requestId: body.error.requestId, code: body.error.code });
      }
    } catch (error) {
      logMonetisationClientEvent("ops_billing_snapshot_refresh_error", null, "ops", { userId, code: "network_error" });
      setSnapshot({
        ok: false,
        error: { code: "FETCH_FAILED", message: "Unable to fetch snapshot", requestId: "unknown" },
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSnapshot("view");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stripeLinks = {
    customer: stripeCustomerId ? `https://dashboard.stripe.com/customers/${stripeCustomerId}` : null,
    subscription: stripeSubscriptionId ? `https://dashboard.stripe.com/subscriptions/${stripeSubscriptionId}` : null,
  };

  return (
    <div id="billing-triage" className="rounded-2xl border border-black/10 bg-white/80 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">{OPS_BILLING_COPY.title}</p>
          <p className="text-sm text-[rgb(var(--muted))]">{OPS_BILLING_COPY.subtitle}</p>
        </div>
        <button
          type="button"
          className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-[rgb(var(--ink))] hover:bg-slate-50 disabled:opacity-50"
          onClick={() => fetchSnapshot("refresh")}
          disabled={loading}
        >
          {loading ? "Refreshing..." : OPS_BILLING_COPY.refresh}
        </button>
      </div>
      {snapshot && !snapshot.ok ? (
        <div className="mt-3">
          <ErrorBanner title="Unable to load snapshot" message={snapshot.error.message} requestId={snapshot.error.requestId} />
        </div>
      ) : null}
      {snapshot && snapshot.ok ? (
        <div className="mt-3 space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-black/10 bg-white px-3 py-2">
              <p className="text-xs font-semibold text-[rgb(var(--ink))]">{OPS_BILLING_COPY.localTitle}</p>
              <ul className="mt-1 space-y-1 text-[11px] text-[rgb(var(--muted))]">
                <li>Subscription: {snapshot.local.subscriptionStatus}</li>
                <li>Credits: {snapshot.local.creditsAvailable}</li>
                <li>
                  Last event: {snapshot.local.lastBillingEvent?.kind ?? "none"}{" "}
                  {snapshot.local.lastBillingEvent?.at ? `· ${snapshot.local.lastBillingEvent.at}` : ""}
                </li>
              </ul>
            </div>
            <div className="rounded-xl border border-black/10 bg-white px-3 py-2">
              <p className="text-xs font-semibold text-[rgb(var(--ink))]">{OPS_BILLING_COPY.stripeTitle}</p>
              <ul className="mt-1 space-y-1 text-[11px] text-[rgb(var(--muted))]">
                <li>Customer: {snapshot.stripe.hasCustomer ? snapshot.stripe.customerIdMasked ?? "yes" : "none"}</li>
                <li>
                  Subscription: {snapshot.stripe.subscriptionStatus}
                  {snapshot.stripe.cancelAtPeriodEnd ? " · cancels at period end" : ""}
                </li>
                <li>
                  Period end: {snapshot.stripe.currentPeriodEnd ?? "—"} {snapshot.stripe.priceKey ? `· ${snapshot.stripe.priceKey}` : ""}
                </li>
                <li>Latest invoice: {snapshot.stripe.latestInvoiceStatus ?? "—"}</li>
                <li>Last payment error: {snapshot.stripe.lastPaymentErrorCode ?? "none"}</li>
              </ul>
            </div>
          </div>
          {nextStep ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-900">
              <p className="text-xs font-semibold text-emerald-900">{OPS_BILLING_COPY.nextStepLabel}</p>
              <p>{nextStep.message}</p>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <Link
              href={nextStep?.billingLink ?? "/app/billing?from=ops_support&support=1"}
              className="rounded-full border border-black/10 bg-white px-3 py-1 font-semibold text-[rgb(var(--ink))] hover:bg-slate-50"
              onClick={() => logMonetisationClientEvent("ops_billing_triage_open_billing_click", null, "ops", { userId })}
            >
              {OPS_BILLING_COPY.openBilling}
            </Link>
            <Link
              href={nextStep?.portalLink ?? "/api/billing/portal?mode=navigation"}
              className="rounded-full border border-black/10 bg-white px-3 py-1 font-semibold text-[rgb(var(--ink))] hover:bg-slate-50"
              onClick={() => logMonetisationClientEvent("ops_billing_triage_open_portal_click", null, "ops", { userId })}
            >
              {OPS_BILLING_COPY.openPortal}
            </Link>
            {stripeLinks.customer ? (
              <a
                href={stripeLinks.customer}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-black/10 bg-white px-3 py-1 font-semibold text-[rgb(var(--ink))] hover:bg-slate-50"
                onClick={() =>
                  logMonetisationClientEvent("ops_billing_triage_open_dashboard_click", null, "ops", { userId, type: "customer" })
                }
              >
                {OPS_BILLING_COPY.openStripeCustomer}
              </a>
            ) : null}
            {stripeLinks.subscription ? (
              <a
                href={stripeLinks.subscription}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-black/10 bg-white px-3 py-1 font-semibold text-[rgb(var(--ink))] hover:bg-slate-50"
                onClick={() =>
                  logMonetisationClientEvent("ops_billing_triage_open_dashboard_click", null, "ops", { userId, type: "subscription" })
                }
              >
                {OPS_BILLING_COPY.openStripeSubscription}
              </a>
            ) : null}
          </div>
        </div>
      ) : snapshot ? null : (
        <p className="mt-3 text-xs text-[rgb(var(--muted))]">{OPS_BILLING_COPY.missing}</p>
      )}
    </div>
  );
}
