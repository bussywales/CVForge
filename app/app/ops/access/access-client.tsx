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
  record?: { grantedAt?: string | null; revokedAt?: string | null; note?: string | null } | null;
  invite?: {
    status: "pending" | "claimed" | "revoked";
    invitedAt?: string | null;
    claimedAt?: string | null;
    revokedAt?: string | null;
    expiresAt?: string | null;
    token?: string | null;
    link?: string | null;
    emailHashPrefix?: string | null;
  } | null;
  recentInvites?: {
    emailHashPrefix?: string | null;
    invitedAt?: string | null;
    claimedAt?: string | null;
    revokedAt?: string | null;
    status: string;
    token?: string | null;
    link?: string | null;
    claimedUserId?: string | null;
  }[];
};

export default function AccessClient({ requestId }: { requestId: string | null }) {
  const [query, setQuery] = useState("");
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [loading, setLoading] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
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

  const inviteStatusLabel = useMemo(() => {
    if (!lookup?.invite) return "No invite";
    const status = lookup.invite.status;
    if (status === "pending") return "Invite pending";
    if (status === "claimed") return "Invite claimed";
    if (status === "revoked") return "Invite revoked";
    return "No invite";
  }, [lookup?.invite]);

  const inviteLink = lookup?.invite?.link ?? null;
  const invitePending = lookup?.invite?.status === "pending";
  const userFound = lookup?.userFound ?? false;

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
        invite: data.invite ?? null,
        recentInvites: data.recentInvites ?? [],
      });
      setUserFoundLabel(data.userFound ? "Found" : "Not found");
      logMonetisationClientEvent("ops_access_lookup", null, "ops");
      logMonetisationClientEvent("ops_early_access_search", null, "ops", { hashedEmailPrefix: data?.invite?.emailHashPrefix ?? null });
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

  const createInvite = async () => {
    const email = query.trim();
    if (!email) return;
    setInviteLoading(true);
    setError(null);
    setActionMessage(null);
    try {
      const res = await fetch("/api/ops/access/invite", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const data = await res.json().catch(() => null);
      if (res.status === 429 || data?.error?.code === "RATE_LIMITED") {
        setActionMessage("Rate limited — try again shortly");
        logMonetisationClientEvent("ops_access_error", null, "ops", { actionStatus: "rate_limited" });
        return;
      }
      if (!data?.ok) {
        setError({ message: data?.error?.message ?? "Unable to create invite", requestId: data?.error?.requestId });
        logMonetisationClientEvent("ops_access_error", null, "ops", { actionStatus: "error" });
        return;
      }
      setLookup((prev) => ({
        ...(prev ?? { userFound: false, userId: null, allowedNow: false, source: null }),
        invite: data.invite ? { ...data.invite } : null,
        recentInvites: data.recentInvites ?? prev?.recentInvites ?? [],
      }));
      setActionMessage("Invite created");
      logMonetisationClientEvent("ops_early_access_invite_create", null, "ops");
      runSearch();
    } catch {
      setError({ message: "Unable to create invite", requestId: null });
    } finally {
      setInviteLoading(false);
    }
  };

  const revokeInviteAction = async (tokenOverride?: string | null) => {
    const email = query.trim();
    if (!email && !tokenOverride) return;
    setInviteLoading(true);
    setError(null);
    setActionMessage(null);
    try {
      const res = await fetch("/api/ops/access/invite/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email || undefined, token: tokenOverride ?? undefined }),
      });
      const data = await res.json().catch(() => null);
      if (res.status === 429 || data?.error?.code === "RATE_LIMITED") {
        setActionMessage("Rate limited — try again shortly");
        logMonetisationClientEvent("ops_access_error", null, "ops", { actionStatus: "rate_limited" });
        return;
      }
      if (!data?.ok) {
        setError({ message: data?.error?.message ?? "Unable to revoke invite", requestId: data?.error?.requestId });
        logMonetisationClientEvent("ops_access_error", null, "ops", { actionStatus: "error" });
        return;
      }
      setActionMessage("Invite revoked");
      logMonetisationClientEvent("ops_early_access_invite_revoke", null, "ops");
      runSearch();
    } catch {
      setError({ message: "Unable to revoke invite", requestId: null });
    } finally {
      setInviteLoading(false);
    }
  };

  const copyInstructions = async (inviteLink?: string) => {
    const text = buildInviteInstructions({ inviteLink });
    try {
      await navigator.clipboard.writeText(text);
      setActionMessage("Instructions copied");
    } catch {
      setActionMessage("Copy failed — try manual copy");
    }
    logMonetisationClientEvent("ops_early_access_invite_copy_instructions", null, "ops");
  };

  const copyInviteLink = async (link?: string) => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setActionMessage("Invite link copied");
      logMonetisationClientEvent("ops_early_access_invite_copy_link", null, "ops");
    } catch {
      setActionMessage("Copy failed — try manual copy");
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
          <button
            type="button"
            onClick={() => copyInstructions(inviteLink ?? undefined)}
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
            {lookup?.record?.grantedAt ? <p className="text-[11px] text-[rgb(var(--muted))]">Access granted: {lookup.record.grantedAt}</p> : null}
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
              <p className="text-[11px] text-[rgb(var(--muted))]">Use when the account already exists. Invites are better for users who have not signed up yet.</p>
            </div>
          </div>
        ) : (
          <p className="text-[11px] text-[rgb(var(--muted))]">Search an email to view or create an invite.</p>
        )}
      </div>
      <div className="rounded-2xl border border-black/10 bg-white p-3 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-[rgb(var(--ink))]">Invite</p>
          <span
            className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
              invitePending ? "bg-amber-100 text-amber-800" : lookup?.invite?.status === "claimed" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"
            }`}
          >
            {inviteStatusLabel}
          </span>
        </div>
        {lookup ? (
          <div className="mt-2 space-y-2">
            <p className="text-[11px] text-[rgb(var(--muted))]">User account: {userFound ? "Found" : "Not found yet — invite will activate on signup"}</p>
            {lookup.invite?.invitedAt ? <p className="text-[11px] text-[rgb(var(--muted))]">Invited at: {lookup.invite.invitedAt}</p> : null}
            {lookup.invite?.claimedAt ? <p className="text-[11px] text-[rgb(var(--muted))]">Claimed at: {lookup.invite.claimedAt}</p> : null}
            {lookup.invite?.revokedAt ? <p className="text-[11px] text-[rgb(var(--muted))]">Revoked at: {lookup.invite.revokedAt}</p> : null}
            {lookup.invite?.expiresAt ? <p className="text-[11px] text-[rgb(var(--muted))]">Expires at: {lookup.invite.expiresAt}</p> : null}
            {inviteLink && (
              <p className="text-[11px] text-[rgb(var(--muted))]">
                Invite link: <span className="font-mono text-[10px]">{inviteLink}</span>
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              {!lookup.invite && !userFound ? (
                <button
                  type="button"
                  className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-[rgb(var(--ink))]"
                  onClick={createInvite}
                  disabled={inviteLoading}
                >
                  {inviteLoading ? "Creating…" : "Create invite"}
                </button>
              ) : null}
              {invitePending && inviteLink ? (
                <>
                  <button
                    type="button"
                    className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-[rgb(var(--ink))]"
                    onClick={() => copyInviteLink(inviteLink)}
                    disabled={inviteLoading}
                  >
                    Copy invite link
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-[rgb(var(--ink))]"
                    onClick={() => copyInstructions(inviteLink)}
                    disabled={inviteLoading}
                  >
                    Copy instructions
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-[rgb(var(--ink))]"
                    onClick={() => revokeInviteAction(lookup.invite?.token ?? null)}
                    disabled={inviteLoading}
                  >
                    Revoke invite
                  </button>
                </>
              ) : null}
              {!invitePending && lookup?.invite?.status === "revoked" && !userFound ? (
                <button
                  type="button"
                  className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-[rgb(var(--ink))]"
                  onClick={createInvite}
                  disabled={inviteLoading}
                >
                  Recreate invite
                </button>
              ) : null}
              {!lookup?.invite && userFound ? <p className="text-[11px] text-[rgb(var(--muted))]">User already exists — use grant/revoke above.</p> : null}
              {invitePending ? <p className="text-[11px] text-[rgb(var(--muted))]">Invite will activate as soon as they sign up with this email.</p> : null}
            </div>
          </div>
        ) : (
          <p className="text-[11px] text-[rgb(var(--muted))]">Search an email to manage invites.</p>
        )}
      </div>
      <div className="rounded-2xl border border-black/10 bg-white p-3 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-[rgb(var(--ink))]">Recent invites</p>
          <span className="text-[10px] text-[rgb(var(--muted))]">Last 20</span>
        </div>
        {lookup?.recentInvites?.length ? (
          <div className="mt-2 overflow-x-auto">
            <table className="min-w-full text-left text-[11px] text-[rgb(var(--muted))]">
              <thead>
                <tr>
                  <th className="px-2 py-1">Email (hash)</th>
                  <th className="px-2 py-1">Status</th>
                  <th className="px-2 py-1">Invited</th>
                  <th className="px-2 py-1">Claimed</th>
                  <th className="px-2 py-1">Actions</th>
                </tr>
              </thead>
              <tbody>
                {lookup.recentInvites.map((item, idx) => (
                  <tr key={`${item.emailHashPrefix}-${idx}`} className="border-t border-black/5">
                    <td className="px-2 py-1 font-mono text-[10px]">{item.emailHashPrefix ?? "unknown"}</td>
                    <td className="px-2 py-1 capitalize">{item.status}</td>
                    <td className="px-2 py-1">{item.invitedAt ?? "—"}</td>
                    <td className="px-2 py-1">{item.claimedAt ?? "—"}</td>
                    <td className="px-2 py-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {item.link && item.status === "pending" ? (
                          <>
                            <button
                              type="button"
                              className="rounded-full border border-black/10 bg-white px-2 py-1 text-[10px] font-semibold text-[rgb(var(--ink))]"
                              onClick={() => copyInviteLink(item.link ?? undefined)}
                              disabled={inviteLoading}
                            >
                              Copy link
                            </button>
                            <button
                              type="button"
                              className="rounded-full border border-black/10 bg-white px-2 py-1 text-[10px] font-semibold text-[rgb(var(--ink))]"
                              onClick={() => revokeInviteAction(item.token ?? null)}
                              disabled={inviteLoading}
                            >
                              Revoke
                            </button>
                          </>
                        ) : null}
                        {item.claimedUserId ? (
                          <a href={`/app/ops/users/${item.claimedUserId}`} className="text-[10px] underline">
                            View dossier
                          </a>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-2 text-[11px] text-[rgb(var(--muted))]">No invites yet. Create one to get started.</p>
        )}
      </div>
    </div>
  );
}
