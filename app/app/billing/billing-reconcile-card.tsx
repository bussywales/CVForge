"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";
import BillingSupportModal from "./billing-support-modal";

type Props = {
  show: boolean;
  message: string;
  supportSnippet: string | null;
};

export default function BillingReconcileCard({ show, message, supportSnippet }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (show) {
      logMonetisationClientEvent("billing_reconcile_hint_view", null, "billing");
    }
  }, [show]);

  if (!show) return null;

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-amber-900">Payment detected — credits may take a moment</p>
          <p className="text-[11px]">{message}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded-full border border-amber-300 bg-white px-3 py-1 font-semibold text-amber-800 hover:bg-amber-100"
            onClick={() => {
              logMonetisationClientEvent("billing_reconcile_hint_refresh_click", null, "billing");
              router.refresh();
            }}
          >
            Refresh status
          </button>
          <button
            type="button"
            className="rounded-full border border-amber-300 bg-white px-3 py-1 font-semibold text-amber-800 hover:bg-amber-100"
            onClick={() => {
              setOpen(true);
              logMonetisationClientEvent("billing_reconcile_hint_support_click", null, "billing");
            }}
          >
            Contact support
          </button>
        </div>
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
