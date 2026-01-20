"use client";

import { useEffect, useRef, useState } from "react";
import ErrorBanner from "@/components/ErrorBanner";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";
import BillingTimeline from "./billing-timeline";
import CreditDelayCard from "./credit-delay-card";
import type { BillingTimelineEntry } from "@/lib/billing/billing-timeline";
import type { CreditDelayResult } from "@/lib/billing/billing-credit-delay";
import type { WebhookHealth } from "@/lib/webhook-health";
import { buildBillingTraceSnippet } from "@/lib/billing/billing-trace-snippet";

type Props = {
  initialTimeline: BillingTimelineEntry[];
  initialDelay: CreditDelayResult;
  initialWebhookHealth: WebhookHealth;
  supportPath: string;
};

export default function BillingTracePanel({ initialTimeline, initialDelay, initialWebhookHealth, supportPath }: Props) {
  const [timeline, setTimeline] = useState<BillingTimelineEntry[]>(initialTimeline);
  const [delay, setDelay] = useState<CreditDelayResult>(initialDelay);
  const [webhookHealth, setWebhookHealth] = useState<WebhookHealth>(initialWebhookHealth);
  const [error, setError] = useState<{ message: string; requestId?: string | null } | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    logMonetisationClientEvent("billing_trace_view", null, "billing", { hasTimeline: timeline.length > 0 });
    logMonetisationClientEvent("billing_webhook_health_view", null, "billing", {
      status: webhookHealth.status,
      hasError: Boolean(webhookHealth.lastErrorAt),
    });
  }, [timeline.length, webhookHealth.status, webhookHealth.lastErrorAt]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const focus = new URL(window.location.href).searchParams.get("focus");
    if (focus === "billing_trace" && panelRef.current) {
      panelRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      panelRef.current.classList.add("ring-2", "ring-[rgb(var(--accent))]");
      setTimeout(() => panelRef.current?.classList.remove("ring-2", "ring-[rgb(var(--accent))]"), 1800);
    }
  }, []);

  const handleRecheck = async () => {
    logMonetisationClientEvent("billing_recheck_click", null, "billing");
    setError(null);
    try {
      const res = await fetch("/api/billing/recheck", { method: "GET", cache: "no-store" });
      const body = await res.json();
      if (!body.ok) {
        setError({ message: body.error?.message ?? "Unable to refresh", requestId: body.error?.requestId });
        logMonetisationClientEvent("billing_recheck_result", null, "billing", { ok: false, requestId: body.error?.requestId ?? null });
        return;
      }
      setTimeline(body.model.timeline ?? []);
      setDelay(body.model.delayState);
      setWebhookHealth(body.model.webhookHealth);
      logMonetisationClientEvent("billing_recheck_result", null, "billing", {
        ok: true,
        status: body.model.webhookHealth?.status,
        requestId: body.requestId ?? null,
      });
    } catch {
      setError({ message: "Unable to refresh", requestId: null });
      logMonetisationClientEvent("billing_recheck_result", null, "billing", { ok: false, requestId: null });
    }
  };

  const traceSnippet = buildBillingTraceSnippet({ requestId: timeline[0]?.requestId ?? null, timeline, webhook: webhookHealth, delay });

  return (
    <div ref={panelRef} id="billing-trace" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-[rgb(var(--ink))]">Billing timeline</p>
          <p className="text-xs text-[rgb(var(--muted))]">Recent portal, checkout, webhook, and credits signals.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-[rgb(var(--ink))] hover:bg-slate-50"
            onClick={handleRecheck}
          >
            Re-check status
          </button>
          <button
            type="button"
            className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-[rgb(var(--ink))] hover:bg-slate-50"
            onClick={() => {
              navigator.clipboard.writeText(traceSnippet).catch(() => undefined);
              logMonetisationClientEvent("billing_trace_snippet_copy", null, "billing", {
                hasRequestId: Boolean(timeline[0]?.requestId),
              });
            }}
          >
            Copy billing trace snippet
          </button>
        </div>
      </div>
      {error ? (
        <ErrorBanner
          title="Unable to refresh billing status"
          message={error.message}
          requestId={error.requestId ?? undefined}
        />
      ) : null}
      <BillingTimeline timeline={timeline} supportPath={supportPath} />
      <CreditDelayCard delay={delay} supportPath={supportPath} />
    </div>
  );
}
