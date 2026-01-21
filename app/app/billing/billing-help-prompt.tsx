"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";
import { helpPromptShouldShow, recordHelpPromptDismiss } from "@/lib/billing/help-prompt";
import { buildSupportSnippet } from "@/lib/observability/support-snippet";

type Props = {
  supportSnippet?: string | null;
  portalHref?: string;
  requestId?: string | null;
};

export default function BillingHelpPrompt({ supportSnippet, portalHref = "/api/billing/portal?mode=navigation", requestId }: Props) {
  const [visible, setVisible] = useState(false);
  const [showNoState, setShowNoState] = useState(false);
  const [viewLogged, setViewLogged] = useState(false);

  useEffect(() => {
    const shouldShow = helpPromptShouldShow();
    setVisible(shouldShow);
    if (shouldShow && !viewLogged) {
      logMonetisationClientEvent("billing_help_prompt_view", null, "billing");
      setViewLogged(true);
    }
  }, [viewLogged]);

  if (!visible) return null;

  const handleDismiss = () => {
    recordHelpPromptDismiss();
    setVisible(false);
    logMonetisationClientEvent("billing_help_prompt_dismiss", null, "billing");
  };

  const handleYes = () => {
    recordHelpPromptDismiss();
    setVisible(false);
    logMonetisationClientEvent("billing_help_prompt_yes", null, "billing");
  };

  const handleNo = () => {
    setShowNoState(true);
    logMonetisationClientEvent("billing_help_prompt_no", null, "billing");
  };

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-[rgb(var(--ink))]">Did this resolve your billing issue?</p>
          {!showNoState ? <p className="text-[11px] text-[rgb(var(--muted))]">Let us know so we can close the loop.</p> : <p className="text-[11px] text-[rgb(var(--muted))]">Thanks — here’s a quick way to get support.</p>}
        </div>
        <button type="button" aria-label="Dismiss" className="text-[rgb(var(--muted))]" onClick={handleDismiss}>
          ×
        </button>
      </div>
      {!showNoState ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded-full border border-emerald-300 bg-white px-3 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100"
            onClick={handleYes}
          >
            Yes
          </button>
          <button
            type="button"
            className="rounded-full border border-emerald-300 bg-white px-3 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100"
            onClick={handleNo}
          >
            No
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {supportSnippet ? (
              <button
                type="button"
                className="rounded-full border border-emerald-300 bg-white px-3 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100"
                onClick={() => {
                  navigator.clipboard.writeText(supportSnippet).catch(() => undefined);
                  logMonetisationClientEvent("billing_help_prompt_copy_snippet", null, "billing");
                }}
              >
                Copy support snippet
              </button>
            ) : null}
            <Link
              href={portalHref}
              className="rounded-full border border-emerald-300 bg-white px-3 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100"
              onClick={() => logMonetisationClientEvent("billing_help_prompt_retry_portal_click", null, "billing", { requestId: requestId ?? null })}
            >
              Try portal again
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
