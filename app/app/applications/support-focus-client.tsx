"use client";

import { useEffect } from "react";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";

type FocusTarget = "outreach" | "offer-pack" | "outcome" | "interview-focus-session";

const focusMap: Record<FocusTarget, { targetId: string; fallbackId?: string }> = {
  outreach: { targetId: "outreach" },
  "offer-pack": { targetId: "offer-pack" },
  outcome: { targetId: "outcome", fallbackId: "outcome-loop" },
  "interview-focus-session": { targetId: "interview-focus-session" },
};

function highlight(el: HTMLElement) {
  el.classList.add("ops-focus-highlight");
  setTimeout(() => el.classList.remove("ops-focus-highlight"), 2000);
}

export default function SupportFocusClient({ applicationId }: { applicationId?: string | null }) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const support = params.get("support");
    const from = params.get("from");
    const focus = params.get("focus") as FocusTarget | null;
    if (support !== "1" || from !== "ops_support" || !focus || !(focus in focusMap)) return;

    const target = focusMap[focus];
    const intentKey = `apps_focus_${focus}_${target.targetId}_${applicationId ?? "na"}`;
    if (sessionStorage.getItem(intentKey)) return;
    sessionStorage.setItem(intentKey, "1");

    logMonetisationClientEvent("ops_support_deeplink_attempt", applicationId, "apps", { focus, target: target.targetId });

    const start = performance.now();
    const maxDurationMs = 1500;

    const tryApply = () => {
      const elapsed = performance.now() - start;
      const el = document.getElementById(target.targetId);
      const fallbackEl = !el && target.fallbackId ? document.getElementById(target.fallbackId) : null;
      const found = el ?? fallbackEl;
      if (found) {
        found.scrollIntoView({ block: "start", behavior: "smooth" });
        setTimeout(() => {
          window.scrollTo({ top: window.scrollY - 80, behavior: "smooth" });
        }, 50);
        highlight(found);
        logMonetisationClientEvent("ops_support_deeplink_applied", applicationId, "apps", {
          focus,
          target: target.targetId,
          fallbackUsed: Boolean(fallbackEl),
          elapsedMs: Math.round(elapsed),
        });
        return;
      }
      if (elapsed < maxDurationMs) {
        requestAnimationFrame(tryApply);
      } else {
        logMonetisationClientEvent("ops_support_deeplink_target_missing", applicationId, "apps", {
          focus,
          target: target.targetId,
          elapsedMs: Math.round(elapsed),
        });
      }
    };

    requestAnimationFrame(tryApply);
  }, [applicationId]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const style = document.createElement("style");
    style.innerHTML = `
      .ops-focus-highlight {
        outline: 2px solid rgba(15, 118, 110, 0.35);
        box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.15);
        transition: outline-color 0.4s ease;
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return null;
}
