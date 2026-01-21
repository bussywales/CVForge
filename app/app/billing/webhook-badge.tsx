"use client";

import { useEffect, useState } from "react";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";
import type { WebhookStatusV2 } from "@/lib/webhook-status-v2";

type Props = {
  status: WebhookStatusV2;
  supportSnippet?: string | null;
  creditsAvailable: number;
  correlationConfidence?: { confidence: "unknown" | "healthy" | "delayed" | "failed"; reason: string } | null;
};

export default function WebhookBadge({ status, supportSnippet, creditsAvailable, correlationConfidence }: Props) {
  const [current, setCurrent] = useState<WebhookStatusV2>(status);

  useEffect(() => {
    logMonetisationClientEvent("billing_webhook_badge_view_v2", null, "billing", {
      state: deriveDisplayState(status, creditsAvailable, correlationConfidence),
      reasonCode: status.reasonCode,
      mode: "initial",
    });
  }, [status, creditsAvailable, correlationConfidence]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<WebhookStatusV2>).detail;
      if (!detail) return;
      setCurrent((prev) => {
        const prevDisplay = deriveDisplayState(prev, creditsAvailable, correlationConfidence);
        const nextDisplay = deriveDisplayState(detail, creditsAvailable, correlationConfidence);
        if (prevDisplay !== nextDisplay) {
          logMonetisationClientEvent("billing_webhook_badge_state_change", null, "billing", {
            fromState: prevDisplay,
            toState: nextDisplay,
          });
        }
        logMonetisationClientEvent("billing_webhook_badge_view_v2", null, "billing", { state: nextDisplay, reasonCode: detail.reasonCode, mode: "recheck" });
        return detail;
      });
    };
    window.addEventListener("billing:webhookStatus", handler);
    return () => window.removeEventListener("billing:webhookStatus", handler);
  }, [creditsAvailable, correlationConfidence]);

  const displayState = deriveDisplayState(current, creditsAvailable, correlationConfidence);
  const stateLabel = (() => {
    if (displayState === "healthy") return "OK";
    if (displayState === "neutral") return "Not expected";
    if (displayState === "failed") return "Failed";
    if (displayState === "delayed") return "Delayed";
    return "Watching";
  })();
  const showSupportSnippet = displayState === "delayed" || displayState === "failed" || current.state === "watching";
  const message = (() => {
    if (displayState === "neutral") return "No recent webhook activity. That’s normal unless you’ve just paid.";
    if (displayState === "healthy") return "Webhook looks healthy.";
    if (displayState === "failed") return "Recent webhook failures detected — share a support snippet.";
    if (displayState === "delayed") return "Webhook taking longer than expected — share a support snippet.";
    return current.message;
  })();

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-indigo-100 bg-indigo-50 p-3 text-xs text-indigo-900">
      <span className="font-semibold text-[rgb(var(--ink))]">Webhook status:</span>
      <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-indigo-800">{stateLabel}</span>
      <span className="text-[11px] text-indigo-800">{message}</span>
      {showSupportSnippet && supportSnippet ? (
        <button
          type="button"
          className="rounded-full border border-indigo-200 bg-white px-3 py-1 text-[11px] font-semibold text-indigo-800 hover:bg-indigo-100"
          onClick={() => {
            navigator.clipboard.writeText(supportSnippet).catch(() => undefined);
            logMonetisationClientEvent("billing_webhook_support_cta_click", null, "billing", {
              state: displayState,
              reasonCode: current.reasonCode,
            });
          }}
        >
          Copy support snippet
        </button>
      ) : null}
    </div>
  );
}

function deriveDisplayState(
  status: WebhookStatusV2,
  creditsAvailable: number,
  correlationConfidence?: { confidence: "unknown" | "healthy" | "delayed" | "failed"; reason: string } | null
): "neutral" | "healthy" | "delayed" | "failed" {
  if (correlationConfidence?.confidence === "failed") return "failed";
  if (correlationConfidence?.confidence === "delayed") return "delayed";
  if (status.state === "failed") return "failed";
  if (status.state === "delayed") return "delayed";
  if (creditsAvailable > 0 || status.state === "ok") return "healthy";
  if (status.state === "not_expected") return "neutral";
  return "neutral";
}
