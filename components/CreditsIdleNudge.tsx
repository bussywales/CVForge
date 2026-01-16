"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";

type Props = {
  applicationId?: string | null;
  href: string;
  surface: "dashboard" | "applications";
};

export default function CreditsIdleNudge({ applicationId, href, surface }: Props) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!applicationId || hidden) return;
    logMonetisationClientEvent("credits_idle_nudge_view", applicationId, surface);
  }, [applicationId, hidden, surface]);

  if (!applicationId || !href || hidden) return null;

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold">You’ve got credits ready — finish your next step.</p>
          <p className="text-xs text-emerald-700">Use your credits before they go idle.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={href}
            className="rounded-full bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
            onClick={() =>
              logMonetisationClientEvent("credits_idle_nudge_click", applicationId, surface)
            }
          >
            Go now
          </Link>
          <button
            type="button"
            className="rounded-full border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
            onClick={() => {
              setHidden(true);
              logMonetisationClientEvent("credits_idle_nudge_dismiss", applicationId, surface);
            }}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
