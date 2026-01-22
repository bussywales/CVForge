"use client";

import { useEffect, useMemo } from "react";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";

function maskEmail(email?: string | null) {
  if (!email) return "";
  const [local, domain] = email.split("@");
  if (!domain) return email;
  const maskedLocal = local.length <= 1 ? "*" : `${local[0]}***`;
  const domainParts = domain.split(".");
  const maskedDomain = domainParts
    .map((part, idx) => (idx === domainParts.length - 1 ? part : `${part[0] ?? ""}${"*".repeat(Math.max(0, part.length - 1))}`))
    .join(".");
  return `${maskedLocal}@${maskedDomain}`;
}

export default function EarlyAccessBlock({ email, reason }: { email?: string | null; reason?: string | null }) {
  useEffect(() => {
    logMonetisationClientEvent("early_access_block_view", null, "user", { hasEmail: Boolean(email) });
    logMonetisationClientEvent("early_access_gate_blocked", null, "user", { source: reason ?? null });
  }, [email, reason]);

  const reasonCopy = useMemo(() => {
    if (!reason) return null;
    const map: Record<string, string> = {
      ops: "Ops bypass",
      db_user: "Allowlisted (account)",
      db_email: "Allowlisted (email invite)",
      env: "Allowlisted (env)",
      blocked: "Blocked",
    };
    return map[reason] ?? reason;
  }, [reason]);

  const copySnippet = async () => {
    const snippet = `Early access request | user=${email ?? "unknown"}`;
    try {
      await navigator.clipboard.writeText(snippet);
    } catch {
      // swallow
    }
    logMonetisationClientEvent("early_access_block_copy", null, "user", { hasEmail: Boolean(email) });
  };

  return (
    <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900 shadow-sm">
      <p className="text-xs uppercase tracking-[0.2em] text-amber-700">Early Access</p>
      <h1 className="mt-1 text-lg font-semibold text-[rgb(var(--ink))]">We’re inviting users gradually.</h1>
      <p className="mt-2 text-sm text-[rgb(var(--muted))]">Your account is not yet on the early-access list. If you’d like access, share your email with support and we’ll unlock it soon.</p>
      {reasonCopy ? <p className="mt-1 text-[11px] text-[rgb(var(--muted))]">Status: {reasonCopy}</p> : null}
      {email ? <p className="mt-2 text-sm font-semibold text-[rgb(var(--ink))]">Email: {maskEmail(email)}</p> : null}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={copySnippet}
          className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-[rgb(var(--ink))] hover:bg-slate-50"
        >
          Copy support snippet
        </button>
        <span className="text-[11px] text-[rgb(var(--muted))]">We’ll prioritise early requests.</span>
      </div>
    </div>
  );
}
