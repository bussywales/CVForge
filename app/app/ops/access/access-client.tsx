"use client";

import { useEffect, useMemo, useState } from "react";
import ErrorBanner from "@/components/ErrorBanner";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";
import { buildInviteInstructions } from "@/lib/early-access-invite-text";

type Lookup = {
  userFound: boolean;
  userId: string | null;
  allowedNow: boolean;
  source: string | null;
  dbInviteActive?: boolean;
  record?: { grantedAt?: string | null; revokedAt?: string | null; note?: string | null } | null;
};

export default function AccessClient({ requestId }: { requestId: string | null }) {
  const [query, setQuery] = useState("");
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [error, setError] = useState<{ message?: string | null; requestId?: string | null } | null>(null);
  const [note, setNote] = useState("");
  const [userFoundLabel, setUserFoundLabel] = useState<string>("Unknown");

  const statusLabel = useMemo(() => {
    if (!lookup) return "Unknown";
    if (lookup.allowedNow) return "Allowed";
    return "Blocked";
  }, [lookup]);

  const statusReason = useMemo(() => {
    if (!lookup?.source) return "";
    const map: Record<string, string> = {
      ops: "Ops bypass",
      db_user: "Allowlisted (account)",
      db_email: "Allowlisted (email invite)",
      env: "Allowlisted (env)",
      blocked: "Blocked",
    };
    return map[lookup.source] ?? lookup.source;
  }, [lookup?.source]);

  useEffect(() => {
    logMonetisationClientEvent("ops_access_view", null, "ops");
    logMonetisationClientEvent("ops_access_invite_view", null, "ops");
  }, []);

  const runSearch = async () => {
    const q = query.trim();
    if (!q.includes("@")) {
      setError({ message: "Enter an email to invite or check status" });
      return;
    }
    setLoading(true);
    setError(null);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/ops/access?email=${encodeURIComponent(q)}`, { method: "GET", cache: "no-store" });
      const reqId = res.headers.get("x-request-id");
      const data = await res.json().catch(() => null);
      if (!data?.ok) {
        setError({ message: data?.error?.message ?? "Unable to load access", requestId: data?.error?.requestId });
        return;
      }
      setLookup({
        userFound: Boolean(data.userFound),
        userId: data.userId ?? null,
        allowedNow: data.allowedNow,
        source: data.source ?? null,
        record: data.record ?? null,
        dbInviteActive: data.dbInviteActive ?? false,
      });
      setUserFoundLabel(data.userFound ? "Found" : "Not found");
      logMonetisationClientEvent("ops_access_lookup", null, "ops");
    } catch {
      setError({ message: "Unable to load access", requestId: null });
    } finally {
      setLoading(false);
    }
  };

  const performAction = async (action: "grant" | "revoke") => {
    const email = query.trim();
    if (!email) return;
    setError(null);
    setActionMessage(null);
    const endpoint = action === "grant" ? "/api/ops/access/grant" : "/api/ops/access/revoke";
    try {
      const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, userId: lookup?.userId ?? null, note }) });
      const data = await res.json().catch(() => null);
      if (res.status === 429 || data?.error?.code === "RATE_LIMITED") {
        setActionMessage("Rate limited — try again shortly");
        logMonetisationClientEvent("ops_access_error", null, "ops", { actionStatus: "rate_limited" });
        return;
      }
      if (!data?.ok) {
        setError({ message: data?.error?.message ?? "Action failed", requestId: data?.error?.requestId });
        logMonetisationClientEvent("ops_access_error", null, "ops", { actionStatus: "error" });
        return;
      }
      setActionMessage(action === "grant" ? "Access granted" : "Access revoked");
      logMonetisationClientEvent(action === "grant" ? "ops_access_invite_grant" : "ops_access_invite_revoke", null, "ops");
      runSearch();
    } catch {
      setError({ message: "Action failed", requestId: null });
    }
  };

  const copyInstructions = async () => {
    const text = buildInviteInstructions();
    try {
      await navigator.clipboard.writeText(text);
      setActionMessage("Instructions copied");
    } catch {
      setActionMessage("Copy failed — try manual copy");
    }
    logMonetisationClientEvent("ops_access_invite_copy_instructions", null, "ops");
  };

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">Ops</p>
        <h1 className="text-lg font-semibold text-[rgb(var(--ink))]">Early Access</h1>
        <p className="text-xs text-[rgb(var(--muted))]">Grant or revoke early access without redeploys.</p>
      </div>
      {error ? <ErrorBanner title="Access error" message={error.message ?? "Unable to load"} requestId={error.requestId ?? requestId ?? undefined} /> : null}
      <div className="rounded-2xl border border-black/10 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Email or user id" className="flex-1 rounded-xl border px-3 py-2 text-sm" />
          <button
            type="button"
            onClick={runSearch}
            disabled={loading}
            className="rounded-full bg-[rgb(var(--ink))] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {loading ? "Searching…" : "Search"}
          </button>
          <button
            type="button"
            onClick={copyInstructions}
            className="rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-[rgb(var(--ink))]"
          >
            Copy invite instructions
          </button>
        </div>
      </div>
      <div className="rounded-2xl border border-black/10 bg-white p-3 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-[rgb(var(--ink))]">Access status</p>
          {lookup?.userId ? <span className="text-[10px] text-[rgb(var(--muted))]">User: {lookup.userId}</span> : null}
        </div>
        {lookup ? (
          <div className="mt-2 space-y-2">
            <div className="flex items-center gap-2">
              <span
                className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                  lookup?.allowedNow ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                }`}
              >
                {statusLabel}
              </span>
              {statusReason ? <span className="text-[11px] text-[rgb(var(--muted))]">{statusReason}</span> : null}
            </div>
            <p className="text-[11px] text-[rgb(var(--muted))]">User account: {userFoundLabel}</p>
            <p className="text-[11px] text-[rgb(var(--muted))]">Invite status: {lookup?.dbInviteActive ? "Active" : "None/revoked"}</p>
            {lookup?.record?.grantedAt ? <p className="text-[11px] text-[rgb(var(--muted))]">Invite created: {lookup.record.grantedAt}</p> : null}
            {lookup?.record?.revokedAt ? <p className="text-[11px] text-[rgb(var(--muted))]">Revoked at: {lookup.record.revokedAt}</p> : null}
            {lookup?.record?.note ? <p className="text-[11px] text-[rgb(var(--muted))]">Note: {lookup.record.note}</p> : null}
            {actionMessage ? <p className="text-[11px] text-amber-800">{actionMessage}</p> : null}
            <div className="flex flex-wrap items-center gap-2">
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note" className="rounded-xl border px-3 py-2 text-sm" />
              <button
                type="button"
                className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-[rgb(var(--ink))]"
                onClick={() => performAction("grant")}
                disabled={loading}
              >
                Grant access
              </button>
              <button
                type="button"
                className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-[rgb(var(--ink))]"
                onClick={() => performAction("revoke")}
                disabled={loading}
              >
                Revoke access
              </button>
              <p className="text-[11px] text-[rgb(var(--muted))]">If the user hasn’t signed up yet, the invite will activate when they sign up with this email.</p>
            </div>
          </div>
        ) : (
          <p className="text-[11px] text-[rgb(var(--muted))]">Search an email to view or create an invite.</p>
        )}
      </div>
    </div>
  );
}
