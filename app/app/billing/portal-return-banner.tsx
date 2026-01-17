"use client";

import { useEffect, useState } from "react";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";

type Props = {
  applicationId: string | null;
};

export default function PortalReturnBanner({ applicationId }: Props) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    logMonetisationClientEvent("sub_change_returned", applicationId ?? null, "billing", {});
  }, [applicationId]);

  if (!visible) return null;

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
      <div className="flex items-center justify-between gap-3">
        <span>Subscription settings updated. It may take a moment to refresh.</span>
        <button
          type="button"
          className="rounded-full border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
          onClick={() => {
            setVisible(false);
            const url = new URL(window.location.href);
            url.searchParams.delete("portal");
            window.history.replaceState({}, "", url.toString());
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
