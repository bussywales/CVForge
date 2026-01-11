"use client";

import { useEffect, useState } from "react";

type AutopackGeneratedBannerProps = {
  message: string;
  clearPath: string;
  autoHideMs?: number;
};

export default function AutopackGeneratedBanner({
  message,
  clearPath,
  autoHideMs = 7000,
}: AutopackGeneratedBannerProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.history.replaceState({}, "", clearPath);
    }
    const timer = window.setTimeout(() => {
      setVisible(false);
    }, autoHideMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [autoHideMs, clearPath]);

  if (!visible) {
    return null;
  }

  return (
    <div className="flex items-start justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
      <span>{message}</span>
      <button
        type="button"
        onClick={() => setVisible(false)}
        className="rounded-full border border-emerald-200 bg-white/70 px-2 py-0.5 text-xs font-semibold text-emerald-700 transition hover:bg-white"
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}
