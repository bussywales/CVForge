"use client";

import { useEffect, useState } from "react";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";

export default function InviteAutoClaimClient() {
  const [banner, setBanner] = useState<{ message: string; requestId?: string | null } | null>(null);
  const [retrying, setRetrying] = useState(false);

  const attemptClaim = async (source: "auto" | "retry") => {
    let token: string | null = null;
    try {
      token = localStorage.getItem("cvf_invite_token");
    } catch {
      token = null;
    }
    if (!token) return;
    if (source === "auto") {
      const dedupeKey = `cvf_invite_claimed_${token}`;
      const last = localStorage.getItem(dedupeKey);
      if (last && Date.now() - Number(last) < 24 * 60 * 60 * 1000) return;
    }
    if (source === "retry") {
      logMonetisationClientEvent("invite_claim_banner_retry_click", null, "user");
    }
    logMonetisationClientEvent("early_access_invite_claim_attempt", null, "user", { meta: { source } });
    setRetrying(source === "retry");
    try {
      const res = await fetch("/api/invite/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const body = await res.json().catch(() => null);
      if (body?.ok) {
        try {
          localStorage.removeItem("cvf_invite_token");
          localStorage.setItem(`cvf_invite_claimed_${token}`, `${Date.now()}`);
        } catch {
          // ignore
        }
        logMonetisationClientEvent("early_access_invite_claim_success", null, "user", { meta: { source } });
        setBanner(null);
      } else {
        setBanner({ message: "Invite couldn’t be claimed yet — try again", requestId: body?.error?.requestId ?? null });
        logMonetisationClientEvent("invite_claim_banner_view", null, "user");
      }
    } catch {
      setBanner({ message: "Invite couldn’t be claimed yet — try again" });
      logMonetisationClientEvent("invite_claim_banner_view", null, "user");
    } finally {
      setRetrying(false);
    }
  };

  useEffect(() => {
    attemptClaim("auto");
  }, []);

  if (!banner) return null;

  return (
    <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>{banner.message}</span>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => attemptClaim("retry")}
            className="rounded-full border border-black/10 bg-white px-3 py-1 font-semibold text-[rgb(var(--ink))]"
            disabled={retrying}
          >
            {retrying ? "Trying…" : "Try again"}
          </button>
          {banner.requestId ? (
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(`Support snippet: requestId=${banner.requestId}`);
                  logMonetisationClientEvent("invite_claim_banner_copy", null, "user");
                } catch {
                  // ignore
                }
              }}
              className="rounded-full border border-black/10 bg-white px-3 py-1 font-semibold text-[rgb(var(--ink))]"
            >
              Copy support snippet
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              setBanner(null);
              logMonetisationClientEvent("invite_claim_banner_dismiss", null, "user");
            }}
            className="rounded-full border border-black/10 bg-white px-3 py-1 font-semibold text-[rgb(var(--muted))]"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
