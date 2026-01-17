"use client";

import { useEffect, useState } from "react";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";

type Props = {
  planKey?: string | null;
  status?: "success" | "cancel" | null;
  isActive: boolean;
};

export default function StreakSaverBanner({ planKey, status, isActive }: Props) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    logMonetisationClientEvent("streak_saver_billing_banner_view", null, "billing", {
      planKey,
    });
  }, [planKey]);

  useEffect(() => {
    if (!status) return;
    logMonetisationClientEvent("streak_saver_checkout_return", null, "billing", {
      status,
      planKey,
    });
    if (status === "success" && isActive) {
      logMonetisationClientEvent("streak_saver_sub_active_detected", null, "billing", {
        planKey,
      });
    }
  }, [isActive, planKey, status]);

  if (hidden) return null;

  return (
    <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-indigo-900">You’re one step away from keeping momentum.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="text-xs font-semibold text-indigo-800 underline-offset-2 hover:underline"
            onClick={() => {
              setHidden(true);
              logMonetisationClientEvent("streak_saver_billing_banner_dismiss", null, "billing", {
                planKey,
              });
            }}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
