"use client";

import { useEffect, useState } from "react";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";
import type { WebhookStatusV2 } from "@/lib/webhook-status-v2";

type Props = {
  status: WebhookStatusV2;
  supportSnippet?: string | null;
};

export default function WebhookBadge({ status, supportSnippet }: Props) {
  const [current, setCurrent] = useState<WebhookStatusV2>(status);

  useEffect(() => {
    logMonetisationClientEvent("billing_webhook_badge_view", null, "billing", {
      state: status.state,
      reasonCode: status.reasonCode,
      mode: "initial",
    });
  }, [status.reasonCode, status.state]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<WebhookStatusV2>).detail;
      if (!detail) return;
      setCurrent((prev) => {
        if (prev.state !== detail.state) {
          logMonetisationClientEvent("billing_webhook_badge_state_change", null, "billing", {
            fromState: prev.state,
            toState: detail.state,
          });
        }
        logMonetisationClientEvent("billing_webhook_badge_view", null, "billing", {
          state: detail.state,
          reasonCode: detail.reasonCode,
          mode: "recheck",
        });
        return detail;
      });
    };
    window.addEventListener("billing:webhookStatus", handler);
    return () => window.removeEventListener("billing:webhookStatus", handler);
  }, []);

  const stateLabel = (() => {
    if (current.state === "ok") return "OK";
    if (current.state === "not_expected") return "Not expected";
    if (current.state === "watching") return "Watching";
    return "Delayed";
  })();

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-indigo-100 bg-indigo-50 p-3 text-xs text-indigo-900">
      <span className="font-semibold text-[rgb(var(--ink))]">Webhook status:</span>
      <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-indigo-800">{stateLabel}</span>
      <span className="text-[11px] text-indigo-800">{current.message}</span>
      {current.state === "delayed" && supportSnippet ? (
        <button
          type="button"
          className="rounded-full border border-indigo-200 bg-white px-3 py-1 text-[11px] font-semibold text-indigo-800 hover:bg-indigo-100"
          onClick={() => {
            navigator.clipboard.writeText(supportSnippet).catch(() => undefined);
            logMonetisationClientEvent("billing_webhook_badge_delayed_snippet_copy", null, "billing", {
              state: current.state,
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
