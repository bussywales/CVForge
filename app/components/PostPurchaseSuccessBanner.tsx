"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loadPendingAction, clearPendingAction, buildReturnToUrl } from "@/lib/billing/pending-action";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";

type Props = {
  applicationId?: string | null;
  surface?: string;
  show: boolean;
};

export default function PostPurchaseSuccessBanner({ applicationId, surface = "applications", show }: Props) {
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!show) return;
    const pending = loadPendingAction();
    if (!pending || (applicationId && pending.applicationId !== applicationId)) return;
    const url = buildReturnToUrl(pending);
    setPendingHref(url);
    if (pending.applicationId) {
      logMonetisationClientEvent(
        "billing_success_banner_view",
        pending.applicationId,
        surface,
        { actionKey: pending.type }
      );
    }
  }, [applicationId, surface, show]);

  if (!show || !pendingHref) return null;

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-emerald-800">
            Top up successful — you’re ready to continue.
          </p>
          <p className="text-xs text-emerald-700">Resume the action you were working on.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-full border border-emerald-200 bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
            onClick={() => {
              const pending = loadPendingAction();
              if (pending?.applicationId) {
                logMonetisationClientEvent(
                  "billing_success_banner_resume_click",
                  pending.applicationId,
                  surface,
                  { actionKey: pending.type }
                );
              }
              clearPendingAction();
              router.push(pendingHref);
            }}
          >
            Resume
          </button>
          <button
            type="button"
            className="rounded-full border border-emerald-200 px-4 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
            onClick={() => {
              const pending = loadPendingAction();
              if (pending?.applicationId) {
                logMonetisationClientEvent(
                  "billing_success_banner_dismiss",
                  pending.applicationId,
                  surface,
                  { actionKey: pending.type }
                );
              }
              clearPendingAction();
              setPendingHref(null);
            }}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
