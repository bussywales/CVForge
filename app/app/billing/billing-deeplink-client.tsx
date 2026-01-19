"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { resolveBillingDeeplink } from "@/lib/billing/billing-deeplink";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";

type Props = {
  onHighlight?: (key: string | null) => void;
};

export default function BillingDeepLinkClient({ onHighlight }: Props) {
  const searchParams = useSearchParams();
  const appliedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!searchParams) return;
    const intent = resolveBillingDeeplink(searchParams);
    if (!intent) return;
    if (appliedRef.current === intent.intentKey) return;
    const sessionKey = `billing_dl_${intent.intentKey}`;
    if (typeof window !== "undefined" && window.sessionStorage.getItem(sessionKey)) {
      appliedRef.current = intent.intentKey;
      return;
    }

    let attempts = 0;
    const supportFlag = searchParams.get("support") === "1";
    const tryApply = () => {
      const anchorEl = typeof document !== "undefined" ? document.getElementById(intent.anchor) : null;
      attempts += 1;
      if (!anchorEl) {
        if (attempts < 10) {
          window.setTimeout(tryApply, 100);
        } else {
          try {
            logMonetisationClientEvent("ops_support_deeplink_target_missing", null, "billing", {
              kind: intent.kind,
              target: intent.target,
              anchor: intent.anchor,
              from: searchParams.get("from") ?? undefined,
              support: supportFlag,
            });
          } catch {
            // ignore
          }
        }
        return;
      }
      anchorEl.scrollIntoView({ behavior: "smooth", block: "start" });
      anchorEl.classList.add("ring-2", "ring-amber-400", "ring-offset-2", "transition", "duration-500");
      if (supportFlag) {
        const helper = document.createElement("div");
        helper.textContent = "Focused for support — review and choose safely.";
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
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(sessionKey, "1");
      }
      try {
        logMonetisationClientEvent("ops_support_deeplink_applied", null, "billing", {
          kind: intent.kind,
          target: intent.target,
          anchor: intent.anchor,
          from: searchParams.get("from") ?? undefined,
          support: supportFlag,
        });
      } catch {
        // ignore
      }
    };

    tryApply();
  }, [onHighlight, searchParams]);

  return null;
}
