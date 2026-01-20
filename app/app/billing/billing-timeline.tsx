"use client";

import { useEffect } from "react";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";
import type { BillingTimelineEntry } from "@/lib/billing/billing-timeline";
import { buildSupportSnippet } from "@/lib/observability/support-snippet";
import CopyIconButton from "@/components/CopyIconButton";

function iconFor(kind: BillingTimelineEntry["kind"]) {
  switch (kind) {
    case "checkout_success":
    case "credits_applied":
      return "✅";
    case "checkout_error":
    case "portal_error":
    case "webhook_error":
      return "⚠️";
    default:
      return "•";
  }
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-GB", { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

type Props = {
  timeline: BillingTimelineEntry[];
  supportPath: string;
};

export default function BillingTimeline({ timeline, supportPath }: Props) {
  useEffect(() => {
    if (timeline.length > 0) {
      logMonetisationClientEvent("billing_timeline_view", null, "billing");
    }
  }, [timeline]);

  if (!timeline.length) {
    return (
      <div className="rounded-2xl border border-black/10 bg-white/70 p-3 text-xs text-[rgb(var(--muted))]">
        Nothing recent yet. Completed payments and portal attempts will show here.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {timeline.map((item, idx) => {
        const snippet = item.requestId
          ? buildSupportSnippet({ action: item.kind, path: supportPath, requestId: item.requestId, code: item.kind })
          : null;
        return (
          <div key={`${item.kind}-${idx}-${item.at}`} className="flex items-center justify-between rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-xs">
            <div className="flex items-center gap-2">
              <span>{iconFor(item.kind)}</span>
              <div>
                <p className="font-semibold text-[rgb(var(--ink))]">{item.label}</p>
                <p className="text-[11px] text-[rgb(var(--muted))]">{formatTime(item.at)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                  item.status === "ok"
                    ? "bg-emerald-100 text-emerald-800"
                    : item.status === "error"
                      ? "bg-rose-100 text-rose-700"
                      : "bg-slate-100 text-[rgb(var(--ink))]"
                }`}
              >
                {item.status.toUpperCase()}
              </span>
              {snippet ? (
                <CopyIconButton
                  text={snippet}
                  label="Copy ref"
                  onCopy={() =>
                    logMonetisationClientEvent("billing_timeline_support_snippet_copy", null, "billing", { requestId: item.requestId })
                  }
                />
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
