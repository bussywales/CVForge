"use client";

import { useEffect, useRef, useState } from "react";
import { resolveBillingDeeplink } from "@/lib/billing/billing-deeplink";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";
import { applyBillingDeeplinkIntent } from "@/lib/billing/billing-deeplink-apply";

type Props = {
  onHighlight?: (key: string | null) => void;
};

export default function BillingDeepLinkClient({ onHighlight }: Props) {
  const appliedRef = useRef<string | null>(null);
  const [debugNote, setDebugNote] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const intent = resolveBillingDeeplink(params);
    if (!intent) return;
    if (appliedRef.current === intent.intentKey) return;
    const sessionKey = `billing_dl_${intent.intentKey}`;
    if (window.sessionStorage.getItem(sessionKey)) {
      appliedRef.current = intent.intentKey;
      return;
    }
    const supportFlag = params.get("support") === "1";
    const debugFlag = supportFlag && params.get("from") === "ops_support" && params.get("debug") === "1";

    const setDebug = (msg: string) => {
      if (!debugFlag) return;
      setDebugNote(msg);
      window.setTimeout(() => setDebugNote(null), 2000);
    };

    setDebug(`Ops deeplink: attempting -> ${intent.anchor}`);
    try {
      logMonetisationClientEvent("ops_support_deeplink_attempt", null, "billing", {
        kind: intent.kind,
        target: intent.target,
        anchor: intent.anchor,
        from: params.get("from") ?? undefined,
        support: supportFlag,
      });
    } catch {
      // ignore
    }

    applyBillingDeeplinkIntent({
      intent: { ...intent, fallbackAnchor: intent.kind === "pack" ? "packs" : intent.fallbackAnchor },
      getElement: () => document.getElementById(intent.anchor),
      onFound: (anchorEl, elapsedMs, fallbackUsed) => {
        const startY = window.scrollY;
        const targetRect = anchorEl.getBoundingClientRect();
        anchorEl.scrollIntoView({ behavior: "smooth", block: "start" });
        requestAnimationFrame(() => {
          const afterScrollY = window.scrollY;
          const delta = Math.abs(afterScrollY - startY);
          if (delta < 20) {
            window.scrollTo({ top: startY + targetRect.top - 96, behavior: "smooth" });
          } else {
            window.scrollBy({ top: -48, behavior: "smooth" });
          }
        });
        anchorEl.classList.add("ring-2", "ring-amber-400", "ring-offset-2", "transition", "duration-500");
        if (supportFlag) {
          const helper = document.createElement("div");
          helper.textContent = "Support link opened — review and choose safely.";
          helper.setAttribute("data-billing-support-helper", "1");
          helper.className = "mt-2 text-xs text-amber-700";
          anchorEl.appendChild(helper);
          window.setTimeout(() => helper.remove(), 2000);
        }
        const handleClick = () => {
          try {
            logMonetisationClientEvent("ops_support_deeplink_cta_click", null, "billing", {
              kind: intent.kind,
              target: intent.target,
              cta: "section",
            });
          } catch {
            // ignore
          }
        };
        anchorEl.addEventListener("click", handleClick, { once: true });
        window.setTimeout(() => {
          anchorEl.classList.remove("ring-2", "ring-amber-400", "ring-offset-2");
          anchorEl.removeEventListener("click", handleClick);
        }, 2000);

        onHighlight?.(intent.highlightKey);
        appliedRef.current = intent.intentKey;
        window.sessionStorage.setItem(sessionKey, "1");
        setDebug(`Ops deeplink: applied -> ${intent.anchor}`);
        try {
          logMonetisationClientEvent("ops_support_deeplink_applied", null, "billing", {
            kind: intent.kind,
            target: intent.target,
            anchor: intent.anchor,
            fallbackUsed,
            from: params.get("from") ?? undefined,
            support: supportFlag,
            timeToAnchorMs: elapsedMs,
          });
        } catch {
          // ignore
        }
      },
      onMissing: (elapsedMs) => {
        setDebug(`Ops deeplink: missing -> ${intent.anchor}`);
        try {
          logMonetisationClientEvent("ops_support_deeplink_target_missing", null, "billing", {
            kind: intent.kind,
            target: intent.target,
            anchor: intent.anchor,
            from: params.get("from") ?? undefined,
            support: supportFlag,
            elapsedMs,
          });
        } catch {
          // ignore
        }
      },
    });
  }, [onHighlight]);

  if (!debugNote) return null;
  return <div className="text-[10px] text-amber-700">{debugNote}</div>;
}
