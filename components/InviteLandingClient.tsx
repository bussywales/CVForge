"use client";

import { useEffect, useState } from "react";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";

function storeTokenSafe(token: string) {
  try {
    localStorage.setItem("cvf_invite_token", token);
  } catch {
    // ignore
  }
}

export default function InviteLandingClient({ token, isAuthed = false }: { token: string; isAuthed?: boolean }) {
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    storeTokenSafe(token);
    logMonetisationClientEvent("invite_landing_view", null, "user", { meta: { hasToken: Boolean(token), from: "invite" } });
  }, [token]);

  const handleContinue = () => {
    if (token) {
      storeTokenSafe(token);
    }
    logMonetisationClientEvent("invite_landing_continue_click", null, "user", { meta: { hasToken: Boolean(token), from: "invite" } });
    window.location.href = "/login?from=invite";
  };

  const handleClaimNow = async () => {
    if (!token) return;
    setClaiming(true);
    setError(null);
    storeTokenSafe(token);
    logMonetisationClientEvent("early_access_invite_claim_attempt", null, "user", { meta: { source: "landing" } });
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
        logMonetisationClientEvent("early_access_invite_claim_success", null, "user", { meta: { source: "landing" } });
        window.location.href = "/app";
        return;
      }
      setError("Invite couldn’t be claimed yet.");
    } catch {
      setError("Invite couldn’t be claimed yet.");
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={handleContinue}
        className="w-full rounded-2xl bg-[rgb(var(--accent))] px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[rgb(var(--accent-strong))]"
      >
        Continue
      </button>
      {isAuthed ? (
        <button
          type="button"
          onClick={handleClaimNow}
          disabled={claiming}
          className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-semibold text-[rgb(var(--ink))] shadow-sm hover:border-black/20"
        >
          {claiming ? "Claiming…" : "Claim invite now"}
        </button>
      ) : null}
      {error ? <p className="text-xs text-amber-700">{error}</p> : null}
    </div>
  );
}
