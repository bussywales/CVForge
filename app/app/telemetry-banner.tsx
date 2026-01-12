"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const DISMISS_KEY = "cvforgeTelemetryNoticeDismissed";

type TelemetryBannerProps = {
  telemetryOptIn: boolean;
};

export default function TelemetryBanner({ telemetryOptIn }: TelemetryBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    } finally {
      setReady(true);
    }
  }, []);

  if (!ready || telemetryOptIn || dismissed) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p>
          Want better Role Fit for more job types? You can opt in to share anonymised job advert
          signals. {" "}
          <Link
            href="/app/profile#privacy"
            className="font-semibold text-amber-800 underline-offset-2 hover:underline"
          >
            Update privacy settings
          </Link>
          .
        </p>
        <button
          type="button"
          onClick={() => {
            try {
              localStorage.setItem(DISMISS_KEY, "1");
            } catch {
              // Ignore storage errors.
            }
            setDismissed(true);
          }}
          className="rounded-full border border-amber-200 bg-white/80 px-2 py-0.5 text-xs font-semibold text-amber-800 transition hover:bg-white"
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    </div>
  );
}
