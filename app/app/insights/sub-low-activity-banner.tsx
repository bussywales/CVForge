"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";

type Props = {
  weekKey: string;
  action?: { href: string; label: string; applicationId?: string | null };
};

export default function SubLowActivityBanner({ weekKey, action }: Props) {
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    const key = `sub_low_activity_${weekKey}`;
    const seen = typeof window !== "undefined" ? window.localStorage.getItem(key) : "1";
    if (!seen) {
      setHidden(false);
      if (action?.applicationId) {
        logMonetisationClientEvent(
          "sub_low_activity_view",
          action.applicationId,
          "insights",
          { weekKey }
        );
      }
    }
  }, [action?.applicationId, weekKey]);

  if (hidden) return null;

  const handleDismiss = () => {
    const key = `sub_low_activity_${weekKey}`;
    if (typeof window !== "undefined") {
      window.localStorage.setItem(key, "1");
    }
    setHidden(true);
    if (action?.applicationId) {
      logMonetisationClientEvent(
        "sub_low_activity_dismiss",
        action.applicationId,
        "insights",
        { weekKey }
      );
    }
  };

  return (
    <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-amber-800">Save your streak</p>
          <p className="text-xs text-amber-700">
            Do one small step now to keep your momentum.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {action ? (
            <Link
              href={action.href}
              className="rounded-full bg-amber-700 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800"
              onClick={() => {
                if (action.applicationId) {
                  logMonetisationClientEvent(
                    "sub_home_cta_click",
                    action.applicationId,
                    "insights",
                    { action: "low_activity", weekKey }
                  );
                }
                handleDismiss();
              }}
            >
              Do a quick step
            </Link>
          ) : null}
          <button
            type="button"
            className="rounded-full border border-amber-200 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100"
            onClick={handleDismiss}
          >
            Not today
          </button>
        </div>
      </div>
    </div>
  );
}
