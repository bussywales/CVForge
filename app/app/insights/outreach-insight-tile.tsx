"use client";

import Link from "next/link";
import { useEffect } from "react";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";
import type { OutreachInsight } from "@/lib/outreach-insights";

type Props = {
  applicationId?: string | null;
  insight: OutreachInsight;
};

export default function OutreachInsightTile({ applicationId, insight }: Props) {
  useEffect(() => {
    logMonetisationClientEvent("outreach_insight_view", applicationId ?? null, "insights", {
      replyRate: insight.replyRate,
    });
  }, [applicationId, insight.replyRate]);

  return (
    <div className="rounded-3xl border border-black/10 bg-white/70 p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[rgb(var(--muted))]">
            Outreach performance
          </p>
          <p className="text-lg font-semibold text-[rgb(var(--ink))]">
            Reply rate: {insight.replyRate}%
          </p>
        </div>
        <Link
          href="/app/applications?view=outreach"
          className="rounded-full border border-black/10 bg-[rgb(var(--ink))] px-3 py-2 text-xs font-semibold text-white"
          onClick={() =>
            logMonetisationClientEvent("outreach_insight_click", applicationId ?? null, "insights")
          }
        >
          Open outreach
        </Link>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[rgb(var(--muted))]">
        <span>Sent: {insight.sent}</span>
        <span>Replies: {insight.replies}</span>
        <span>Follow-ups: {insight.followups}</span>
      </div>
      <p className="mt-2 text-sm text-[rgb(var(--muted))]">{insight.tip}</p>
    </div>
  );
}
