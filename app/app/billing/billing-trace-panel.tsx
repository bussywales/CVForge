"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ErrorBanner from "@/components/ErrorBanner";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";
import BillingTimeline from "./billing-timeline";
import CreditDelayCard from "./credit-delay-card";
import type { BillingTimelineEntry } from "@/lib/billing/billing-timeline";
import type { CreditDelayResult } from "@/lib/billing/billing-credit-delay";
import type { WebhookHealth } from "@/lib/webhook-health";
import { buildBillingTraceSnippet } from "@/lib/billing/billing-trace-snippet";
import { createBillingCorrelation, type BillingCorrelation } from "@/lib/billing/billing-correlation";

type Props = {
  initialTimeline: BillingTimelineEntry[];
  initialDelay: CreditDelayResult;
  initialWebhookHealth: WebhookHealth;
  supportPath: string;
};

export default function BillingTracePanel({ initialTimeline, initialDelay, initialWebhookHealth, supportPath }: Props) {
  const router = useRouter();
  const [timeline, setTimeline] = useState<BillingTimelineEntry[]>(initialTimeline);
  const [delay, setDelay] = useState<CreditDelayResult>(initialDelay);
  const [webhookHealth, setWebhookHealth] = useState<WebhookHealth>(initialWebhookHealth);
  const [correlation, setCorrelation] = useState<BillingCorrelation | null>(
    createBillingCorrelation({ timeline: initialTimeline, ledger: [], now: new Date() })
  );
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
    logMonetisationClientEvent("billing_correlation_recheck_click", null, "billing", { priorDelayState: correlation?.delay.state });
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
      setCorrelation(body.model.correlationV2 ?? createBillingCorrelation({ timeline: body.model.timeline ?? [], ledger: [], now: new Date() }));
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

  const computedCorrelation =
    correlation ?? createBillingCorrelation({ timeline, ledger: [], now: new Date() });
  const traceSnippet = buildBillingTraceSnippet({ requestId: timeline[0]?.requestId ?? null, timeline, webhook: webhookHealth, delay });
  useEffect(() => {
    if (computedCorrelation) {
      logMonetisationClientEvent("billing_correlation_view", null, "billing", {
        delayState: computedCorrelation.delay.state,
        confidence: computedCorrelation.delay.confidence,
      });
      if (computedCorrelation.delay.state !== "none") {
        logMonetisationClientEvent("billing_delay_classified", null, "billing", {
          delayState: computedCorrelation.delay.state,
          confidence: computedCorrelation.delay.confidence,
        });
      }
    }
  }, [computedCorrelation, computedCorrelation?.delay.state, computedCorrelation?.delay.confidence]);

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
      {computedCorrelation ? (
        <div className="rounded-2xl border border-black/10 bg-white/70 p-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-[rgb(var(--ink))]">Correlation</p>
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-[rgb(var(--muted))]">
                <span className="font-semibold text-[rgb(var(--ink))]">Checkout</span>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold">
                  {computedCorrelation.correlation.checkout.ok ? computedCorrelation.correlation.checkout.at : "missing"}
                </span>
                <span className="font-semibold text-[rgb(var(--ink))]">→ Webhook</span>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold">
                  {computedCorrelation.correlation.webhook.ok ? computedCorrelation.correlation.webhook.at : "missing"}
                </span>
                <span className="font-semibold text-[rgb(var(--ink))]">→ Credits</span>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold">
                  {computedCorrelation.correlation.ledger.ok ? computedCorrelation.correlation.ledger.at : "missing"}
                </span>
              </div>
            </div>
            {computedCorrelation.delay.state !== "none" ? (
              <div className="flex flex-col items-end gap-1 text-right">
                <p className="text-xs font-semibold text-[rgb(var(--ink))]">Delay classification</p>
                <p className="text-[11px] text-[rgb(var(--muted))]">{computedCorrelation.delay.explanation}</p>
                <div className="flex flex-wrap items-center gap-2">
                  {computedCorrelation.delay.state === "ui_stale" ? (
                    <button
                      type="button"
                      className="rounded-full border border-amber-300 bg-white px-3 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-100"
                      onClick={() => {
                        logMonetisationClientEvent("billing_correlation_recheck_click", null, "billing", {
                          priorDelayState: computedCorrelation.delay.state,
                        });
                        router.refresh();
                      }}
                    >
                      Refresh now
                    </button>
                  ) : computedCorrelation.delay.state === "unknown" ? (
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
                      Copy support snippet
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-[rgb(var(--ink))] hover:bg-slate-50"
                      onClick={handleRecheck}
                    >
                      Re-check in a moment
                    </button>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
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
