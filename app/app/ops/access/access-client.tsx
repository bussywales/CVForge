"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ErrorBanner from "@/components/ErrorBanner";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";

type UserRow = { id: string; email: string | null; createdAt: string | null; name?: string | null; role?: string | null };

type AccessRecord = { grantedAt?: string | null; revokedAt?: string | null; note?: string | null; reason?: string | null; allowed?: boolean };

export default function AccessClient({ requestId }: { requestId: string | null }) {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [selected, setSelected] = useState<UserRow | null>(null);
  const [access, setAccess] = useState<AccessRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [error, setError] = useState<{ message?: string | null; requestId?: string | null } | null>(null);
  const [note, setNote] = useState("");

  const hasResults = users.length > 0;
  const statusLabel = useMemo(() => {
    if (!access) return "Unknown";
    if (access.allowed) return "Allowed";
    return "Blocked";
  }, [access]);

  const statusReason = useMemo(() => {
    if (!access?.reason) return "";
    const map: Record<string, string> = {
      ops_bypass: "Ops bypass",
      db_allowlist: "Allowlisted (db)",
      env_allowlist: "Allowlisted (env)",
      blocked: "Blocked",
    };
    return map[access.reason] ?? access.reason;
  }, [access?.reason]);

  useEffect(() => {
    logMonetisationClientEvent("ops_access_view", null, "ops");
  }, []);

  const runSearch = async () => {
    const q = query.trim();
    if (q.length < 3) {
      setError({ message: "Enter at least 3 characters" });
      setUsers([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/ops/users/search?q=${encodeURIComponent(q)}`, { method: "GET", headers: { Accept: "application/json" } });
      const reqId = res.headers.get("x-request-id");
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError({ message: data?.error?.message ?? "Unable to search", requestId: data?.error?.requestId ?? reqId });
        setUsers([]);
        return;
      }
      setUsers(data.users ?? []);
      logMonetisationClientEvent("ops_access_lookup", null, "ops");
    } catch {
      setError({ message: "Unable to search", requestId: null });
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchAccess = async (user: UserRow) => {
    setActionMessage(null);
    setError(null);
    setSelected(user);
    try {
      const res = await fetch(`/api/ops/access?userId=${encodeURIComponent(user.id)}`, { method: "GET", cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!data?.ok) {
        setError({ message: data?.error?.message ?? "Unable to load access", requestId: data?.error?.requestId });
        return;
      }
      setAccess({ allowed: data.allowed, reason: data.reason, grantedAt: data.record?.grantedAt, revokedAt: data.record?.revokedAt, note: data.record?.note ?? null });
    } catch {
      setError({ message: "Unable to load access", requestId: null });
    }
  };

  const performAction = async (action: "grant" | "revoke") => {
    if (!selected) return;
    setError(null);
    setActionMessage(null);
    const endpoint = action === "grant" ? "/api/ops/access/grant" : "/api/ops/access/revoke";
    try {
      const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: selected.id, note }) });
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
      logMonetisationClientEvent(action === "grant" ? "ops_access_grant" : "ops_access_revoke", null, "ops", { userId: selected.id });
      fetchAccess(selected);
    } catch {
      setError({ message: "Action failed", requestId: null });
    }
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
        </div>
        {hasResults ? (
          <div className="mt-2 overflow-x-auto rounded-xl border border-black/5">
            <table className="min-w-full text-left text-xs">
              <thead className="text-[10px] uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
                <tr>
                  <th className="px-2 py-1">Email</th>
                  <th className="px-2 py-1">User</th>
                  <th className="px-2 py-1">Role</th>
                  <th className="px-2 py-1 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t">
                    <td className="px-2 py-1">{u.email ?? "—"}</td>
                    <td className="px-2 py-1 font-mono text-[10px] text-[rgb(var(--muted))]">{u.id}</td>
                    <td className="px-2 py-1">{u.role ?? "—"}</td>
                    <td className="px-2 py-1 text-right">
                      <button
                        type="button"
                        className="rounded-full border border-black/10 bg-white px-2 py-0.5 text-[11px] font-semibold text-[rgb(var(--ink))]"
                        onClick={() => fetchAccess(u)}
                      >
                        Manage access
                      </button>
                      <Link href={`/app/ops/users/${u.id}`} className="ml-2 rounded-full border border-black/10 bg-white px-2 py-0.5 text-[11px] font-semibold text-[rgb(var(--ink))]">
                        Open dossier
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
      <div className="rounded-2xl border border-black/10 bg-white p-3 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-[rgb(var(--ink))]">Access status</p>
          {selected ? <span className="text-[10px] text-[rgb(var(--muted))]">User: {selected.id}</span> : null}
        </div>
        {selected ? (
          <div className="mt-2 space-y-2">
            <div className="flex items-center gap-2">
              <span
                className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                  access?.allowed ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                }`}
              >
                {statusLabel}
              </span>
              {statusReason ? <span className="text-[11px] text-[rgb(var(--muted))]">{statusReason}</span> : null}
            </div>
            {access?.grantedAt ? <p className="text-[11px] text-[rgb(var(--muted))]">Granted at: {access.grantedAt}</p> : null}
            {access?.revokedAt ? <p className="text-[11px] text-[rgb(var(--muted))]">Revoked at: {access.revokedAt}</p> : null}
            {access?.note ? <p className="text-[11px] text-[rgb(var(--muted))]">Note: {access.note}</p> : null}
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
            </div>
          </div>
        ) : (
          <p className="text-[11px] text-[rgb(var(--muted))]">Select a user to manage access.</p>
        )}
      </div>
    </div>
  );
}
