"use client";

import { useEffect, useMemo, useState } from "react";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";
import type { BillingStatusSnapshot } from "@/lib/billing/billing-status";
import BillingSupportModal from "./billing-support-modal";

type Props = {
  status: BillingStatusSnapshot;
  supportSnippet: string | null;
};

function formatSubscription(status: BillingStatusSnapshot["subscriptionStatus"]) {
  switch (status) {
    case "active":
      return "Subscription active";
    case "trialing":
      return "Trial in progress";
    case "past_due":
      return "Past due — action needed";
    case "canceled":
      return "Subscription canceled";
    default:
      return "No subscription";
  }
}

function formatLastEvent(status: BillingStatusSnapshot["lastBillingEvent"]) {
  if (!status) return "No billing events yet";
  const ts = status.at ? new Date(status.at).toLocaleString("en-GB") : null;
  switch (status.kind) {
    case "portal_error":
      return `Portal error${ts ? ` • ${ts}` : ""}`;
    case "checkout_success":
      return `Checkout success${ts ? ` • ${ts}` : ""}`;
    case "checkout_error":
      return `Checkout canceled${ts ? ` • ${ts}` : ""}`;
    case "subscription_change":
      return `Subscription updated${ts ? ` • ${ts}` : ""}`;
    case "credit_grant":
      return `Credits added${ts ? ` • ${ts}` : ""}`;
    case "usage":
      return `Usage logged${ts ? ` • ${ts}` : ""}`;
    default:
      return "No billing events yet";
  }
}

export default function BillingStatusStrip({ status, supportSnippet }: Props) {
  const [open, setOpen] = useState(false);
  const lastEventCopy = useMemo(() => formatLastEvent(status.lastBillingEvent), [status.lastBillingEvent]);

  useEffect(() => {
    logMonetisationClientEvent("billing_status_view", null, "billing", {
      subscriptionStatus: status.subscriptionStatus,
      portalError: status.flags.portalError,
    });
  }, [status.subscriptionStatus, status.flags.portalError]);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white/80 p-3 text-xs shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-[rgb(var(--ink))]">
          Billing status: {formatSubscription(status.subscriptionStatus)}
        </span>
        <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-[rgb(var(--ink))]">
          Credits: {status.creditsAvailable}
        </span>
        <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-[rgb(var(--ink))]">
          Last action: {lastEventCopy}
        </span>
        {status.flags.fromOpsSupport ? (
          <span className="rounded-full bg-amber-100 px-3 py-1 font-semibold text-amber-800">Ops support link</span>
        ) : null}
        {status.flags.portalError ? (
          <span className="rounded-full bg-rose-100 px-3 py-1 font-semibold text-rose-800">Portal issue detected</span>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="rounded-full border border-black/10 bg-white px-3 py-1 font-semibold text-[rgb(var(--ink))] hover:bg-slate-50"
          onClick={() => setOpen(true)}
        >
          Need help?
        </button>
      </div>
      <BillingSupportModal
        open={open}
        snippet={supportSnippet}
        onClose={() => setOpen(false)}
        onCopy={() => logMonetisationClientEvent("billing_support_snippet_copy", null, "billing")}
        title="Support snippet"
      />
    </div>
  );
}
