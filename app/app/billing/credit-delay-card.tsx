"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";
import { buildSupportSnippet } from "@/lib/observability/support-snippet";
import type { CreditDelayResult } from "@/lib/billing/billing-credit-delay";
import CopyIconButton from "@/components/CopyIconButton";

type Props = {
  delay: CreditDelayResult;
  supportPath: string;
};

export default function CreditDelayCard({ delay, supportPath }: Props) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (delay.state === "watching" || delay.state === "delayed") {
      logMonetisationClientEvent("billing_credit_delay_view", null, "billing", { state: delay.state });
    }
  }, [delay.state]);

  if (delay.state === "ok") return null;

  const snippet =
    delay.requestId && !copied
      ? buildSupportSnippet({
          action: "Billing delay",
          path: supportPath,
          requestId: delay.requestId,
          code: delay.state,
        })
      : delay.requestId
        ? buildSupportSnippet({ action: "Billing delay", path: supportPath, requestId: delay.requestId, code: delay.state })
        : null;

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-amber-900">Payment is still processing</p>
          <p className="text-[11px]">{delay.message}</p>
          <ul className="mt-1 list-disc space-y-1 pl-4 text-[11px]">
            {delay.nextSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded-full border border-amber-300 bg-white px-3 py-1 font-semibold text-amber-800 hover:bg-amber-100"
            onClick={() => {
              logMonetisationClientEvent("billing_credit_delay_refresh_click", null, "billing");
              router.refresh();
            }}
          >
            Refresh status
          </button>
          {snippet ? (
            <CopyIconButton
              text={snippet}
              label="Copy ref"
              onCopy={() => {
                setCopied(true);
                logMonetisationClientEvent("billing_timeline_support_snippet_copy", null, "billing", { requestId: delay.requestId });
              }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
