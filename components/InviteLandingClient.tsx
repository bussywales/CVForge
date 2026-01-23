"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";

function storeTokenSafe(token: string) {
  try {
    localStorage.setItem("cvf_invite_token", token);
  } catch {
    // ignore
  }
}

type InviteValidity = "unknown" | "valid" | "invalid";

export default function InviteLandingClient({ token, isAuthed = false }: { token: string; isAuthed?: boolean }) {
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validity, setValidity] = useState<InviteValidity>("unknown");

  useEffect(() => {
    if (!token) return;
    storeTokenSafe(token);
    logMonetisationClientEvent("invite_landing_view", null, "user", { meta: { hasToken: Boolean(token), from: "invite" } });
    const check = async () => {
      try {
        const res = await fetch(`/api/invite/validate?token=${encodeURIComponent(token)}`, { cache: "no-store" });
        const body = await res.json().catch(() => null);
        if (!body?.ok) {
          setValidity("invalid");
          logMonetisationClientEvent("invite_landing_invalid_view", null, "user", { meta: { reason: body?.error?.code ?? "unknown" } });
          return;
        }
        if (body.valid) {
          setValidity("valid");
        } else {
          setValidity("invalid");
          logMonetisationClientEvent("invite_landing_invalid_view", null, "user", { meta: { reason: body?.reason ?? "unknown" } });
        }
      } catch {
        // leave as unknown to avoid blocking
      }
    };
    check();
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
    logMonetisationClientEvent("invite_landing_claim_click", null, "user");
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

  const supportSnippet = useMemo(() => `Support: invite_token=${token ? token.slice(0, 6) : "unknown"}`, [token]);

  if (validity === "invalid") {
    return (
      <div className="space-y-3 text-left text-sm text-[rgb(var(--muted))]">
        <p className="text-lg font-semibold text-[rgb(var(--ink))]">Invite link invalid or expired</p>
        <p>Copy a support snippet so we can help.</p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(supportSnippet);
                logMonetisationClientEvent("invite_support_snippet_copy", null, "user");
              } catch {
                // ignore
              }
            }}
            className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-semibold text-[rgb(var(--ink))] shadow-sm hover:border-black/20"
          >
            Copy support snippet
          </button>
          <Link href="/login" className="text-xs underline">
            Go to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 text-left">
      <div className="space-y-2 text-sm text-[rgb(var(--muted))]">
        <h2 className="text-xl font-semibold text-[rgb(var(--ink))]">You’ve been invited to CVForge Early Access</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Generate tailored CVs in minutes.</li>
          <li>Export clean PDFs with one click.</li>
          <li>Track applications and next actions in one place.</li>
        </ul>
        <p className="text-xs text-[rgb(var(--muted))]">Your invite is only used to unlock access; no spam.</p>
      </div>
      <div className="flex flex-col items-stretch gap-3">
        {isAuthed ? (
          <>
            <button
              type="button"
              onClick={handleClaimNow}
              disabled={claiming}
              className="w-full rounded-2xl bg-[rgb(var(--accent))] px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[rgb(var(--accent-strong))]"
            >
              {claiming ? "Claiming…" : "Claim invite now"}
            </button>
            <Link
              href="/app"
              className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-center text-sm font-semibold text-[rgb(var(--ink))] shadow-sm hover:border-black/20"
            >
              Go to Dashboard
            </Link>
          </>
        ) : (
          <button
            type="button"
            onClick={handleContinue}
            className="w-full rounded-2xl bg-[rgb(var(--accent))] px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[rgb(var(--accent-strong))]"
          >
            Continue to sign in / create account
          </button>
        )}
        {error ? <p className="text-xs text-amber-700">{error}</p> : null}
      </div>
    </div>
  );
}
