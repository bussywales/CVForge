"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import CopyIconButton from "@/components/CopyIconButton";
import ErrorBanner from "@/components/ErrorBanner";
import { OPS_COPY } from "@/lib/microcopy/ops";
import { buildSupportSnippet } from "@/lib/observability/support-snippet";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";
import { safeReadJson } from "@/lib/http/safe-json";
import { type SupportFocus, type SupportLinkKind } from "@/lib/ops/support-links";
import { type UserRole } from "@/lib/rbac";

type ApplicationOption = {
  id: string;
  title: string;
  company?: string | null;
  status?: string | null;
  updatedAt?: string | null;
  createdAt?: string | null;
};
type AuditEntry = { id: string; action: string; actor: string | null; createdAt: string; meta: Record<string, any> };

type Props = {
  targetUserId: string;
  viewerRole: UserRole;
  applications: ApplicationOption[];
  auditEntries: AuditEntry[];
};

export default function SupportActions({ targetUserId, viewerRole, applications, auditEntries }: Props) {
  const [amount, setAmount] = useState<string>("");
  const [reason, setReason] = useState<string>("Goodwill");
  const [note, setNote] = useState<string>("");
  const [adjustMessage, setAdjustMessage] = useState<string | null>(null);
  const [adjustError, setAdjustError] = useState<{ requestId?: string | null; message?: string | null; code?: string | null } | null>(null);
  const [adjustLoading, setAdjustLoading] = useState(false);

  const [linkKind, setLinkKind] = useState<SupportLinkKind>("billing");
  const [billingTarget, setBillingTarget] = useState<
    "compare" | "subscription_30" | "subscription_80" | "pack_starter" | "pack_pro" | "pack_power" | "portal_return"
  >("compare");
  const [billingFlow, setBillingFlow] = useState<string>("");
  const [linkFocus, setLinkFocus] = useState<SupportFocus>("outreach");
  const [appSelectionMode, setAppSelectionMode] = useState<"recent" | "choose" | "manual">(applications.length ? "recent" : "manual");
  const [linkApplicationId, setLinkApplicationId] = useState<string>(applications[0]?.id ?? "");
  const [manualAppId, setManualAppId] = useState<string>("");
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const [lastGeneratedAt, setLastGeneratedAt] = useState<Date | null>(null);
  const [copyBlocked, setCopyBlocked] = useState(false);
  const [linkError, setLinkError] = useState<{ requestId?: string | null; message?: string | null; code?: string | null } | null>(null);
  const [linkLoading, setLinkLoading] = useState(false);
  const linkRef = useRef<HTMLInputElement | null>(null);

  const canAdjust = viewerRole === "admin" || viewerRole === "super_admin";

  useEffect(() => {
    logMonetisationClientEvent("ops_credit_adjust_view", targetUserId, "ops");
  }, [targetUserId]);

  const applicationOptions = useMemo(
    () =>
      applications.map((app) => ({
        id: app.id,
        label: `${app.title}${app.company ? ` · ${app.company}` : ""}${app.status ? ` (${app.status})` : ""}`,
      })),
    [applications]
  );

  const recentActiveApplication = useMemo(() => {
    const sorted = [...applications].sort((a, b) => {
      const aTime = a.updatedAt ?? a.createdAt;
      const bTime = b.updatedAt ?? b.createdAt;
      return (bTime ? new Date(bTime).getTime() : 0) - (aTime ? new Date(aTime).getTime() : 0);
    });
    const active = sorted.find((app) => app.status !== "rejected" && app.status !== "on_hold");
    return active ?? sorted[0] ?? null;
  }, [applications]);

  const selectedApplicationId = useMemo(() => {
    if (linkKind === "billing") return null;
    if (appSelectionMode === "manual") return manualAppId.trim() || null;
    if (appSelectionMode === "recent") return recentActiveApplication?.id ?? null;
    return linkApplicationId || null;
  }, [appSelectionMode, linkKind, linkApplicationId, manualAppId, recentActiveApplication]);

  const selectedApplicationLabel = useMemo(() => {
    if (!selectedApplicationId) return null;
    const app = applications.find((a) => a.id === selectedApplicationId);
    if (app) {
      return `${app.title}${app.company ? ` · ${app.company}` : ""}`;
    }
    return selectedApplicationId;
  }, [applications, selectedApplicationId]);

  const supportSnippet = (requestId?: string | null, action = "Ops support action", code?: string | null) => {
    if (!requestId) return undefined;
    return buildSupportSnippet({
      requestId,
      action,
      path: typeof window !== "undefined" ? window.location.pathname : "/app/ops/users",
      code,
    });
  };

  const handleAdjust = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canAdjust) return;
    setAdjustLoading(true);
    setAdjustMessage(null);
    setAdjustError(null);
    logMonetisationClientEvent("ops_credit_adjust_submit", targetUserId, "ops", { targetUserId });
    const res = await fetch("/api/ops/credits/adjust", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: targetUserId,
        amount: Number(amount),
        reason,
        note: note || undefined,
      }),
    });
    const { data } = await safeReadJson(res);
    const reqId = res.headers.get("x-request-id") ?? data?.error?.requestId;
    if (!res.ok) {
      setAdjustError({ requestId: reqId, message: data?.error?.message ?? OPS_COPY.creditError, code: data?.error?.code });
      logMonetisationClientEvent("ops_credit_adjust_failed", targetUserId, "ops", { targetUserId, code: data?.error?.code });
      setAdjustLoading(false);
      return;
    }
    const newBalance = data?.newBalance as number | undefined;
    setAdjustMessage(newBalance != null ? OPS_COPY.appliedBalance(newBalance) : OPS_COPY.appliedBalance(0));
    setAmount("");
    setNote("");
    logMonetisationClientEvent("ops_credit_adjust_success", targetUserId, "ops", { targetUserId, ref: data?.ledgerRef });
    setAdjustLoading(false);
  };

  const handleGenerateLink = async () => {
    setLinkLoading(true);
    setLinkError(null);
    setCopyBlocked(false);
    let generatedUrl: string | null = null;
    const payload: Record<string, any> = { userId: targetUserId, kind: linkKind };

    if (linkKind === "billing") {
      payload.kind = "billing";
      if (billingTarget === "subscription_30") {
        payload.plan = "monthly_30";
      } else if (billingTarget === "subscription_80") {
        payload.plan = "monthly_80";
      } else if (billingTarget === "pack_starter") {
        payload.pack = "starter";
      } else if (billingTarget === "pack_pro") {
        payload.pack = "pro";
      } else if (billingTarget === "pack_power") {
        payload.pack = "power";
      } else if (billingTarget === "portal_return") {
        payload.portal = "1";
        const cleanedFlow = billingFlow
          .trim()
          .slice(0, 32)
          .replace(/[^a-zA-Z0-9_-]/g, "");
        if (cleanedFlow) {
          payload.flow = cleanedFlow;
        }
      }
    } else {
      const appId = selectedApplicationId;
      if (!appId && linkKind !== "interview") {
        setLinkError({ requestId: null, message: "Select an application first", code: "INVALID_APP" });
        setLinkLoading(false);
        return null;
      }
      payload.kind = linkKind === "interview" ? "interview" : "application";
      if (appId) {
        payload.appId = appId;
      }
      payload.focus = linkKind === "interview" ? "interview-focus-session" : linkFocus;
    }

    try {
      const res = await fetch("/api/ops/support-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }
      const requestId = res.headers.get("x-request-id") ?? data?.error?.requestId ?? null;
      if (!res.ok) {
        const raw = data ?? (await res.text().catch(() => null));
        setLinkError({ requestId, message: data?.error?.message ?? OPS_COPY.linkError, code: data?.error?.code });
        return;
      }
      let parsedUrl: string | null =
        (data?.url as string | undefined) ??
        null;
      if (!parsedUrl) {
        const raw = await res.text().catch(() => "");
        const match = raw.match(/"url":"(https?:[^"]+)"/);
        if (match?.[1]) {
          parsedUrl = match[1];
        } else {
          const httpsIndex = raw.indexOf("https://");
          if (httpsIndex >= 0) {
            parsedUrl = raw.slice(httpsIndex).split(/\\s|"|}/)[0] ?? null;
          }
        }
      }
      if (!parsedUrl || parsedUrl.indexOf("support=1") === -1) {
        setLinkError({ requestId, message: "We couldn't generate a shareable link just now.", code: "PARSE_FAIL" });
        return;
      }
      generatedUrl = parsedUrl;
      setLinkUrl(parsedUrl);
      setLastGeneratedAt(new Date());
    } finally {
      setLinkLoading(false);
    }
    // Fire-and-forget logging; never block the UI
    try {
      logMonetisationClientEvent("ops_support_link_generate", targetUserId, "ops", { kind: payload.kind, focus: payload.focus });
    } catch {
      // ignore
    }
    return generatedUrl;
  };

  const handleCopy = async () => {
    if (!linkUrl) return;
    try {
      await navigator.clipboard.writeText(linkUrl);
      setCopyBlocked(false);
      logMonetisationClientEvent("ops_support_link_copy", targetUserId, "ops", { kind: linkKind });
    } catch {
      setCopyBlocked(true);
      if (linkRef.current) {
        linkRef.current.focus();
        linkRef.current.select();
      }
    }
  };

  return (
    <div className="rounded-2xl border border-black/10 bg-white/80 p-4">
      <p className="text-sm font-semibold text-[rgb(var(--ink))]">{OPS_COPY.supportActions}</p>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <div className="space-y-3 rounded-xl border border-black/10 bg-white/70 p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-[rgb(var(--ink))]">{OPS_COPY.manualCredit}</p>
            {!canAdjust ? <span className="text-xs text-[rgb(var(--muted))]">Admin only</span> : null}
          </div>
          {adjustError ? (
            <ErrorBanner
              title={OPS_COPY.creditError}
              message={adjustError.message ?? OPS_COPY.creditError}
              requestId={adjustError.requestId ?? undefined}
              supportSnippet={supportSnippet(adjustError.requestId, "Apply credit adjustment", adjustError.code)}
            />
          ) : null}
          {adjustMessage ? <div className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{adjustMessage}</div> : null}
          <form className="space-y-3" onSubmit={handleAdjust}>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[rgb(var(--ink))]">Amount</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
                placeholder="e.g. 10 or -10"
                disabled={!canAdjust}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[rgb(var(--ink))]">Reason</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
                disabled={!canAdjust}
              >
                <option>Goodwill</option>
                <option>Refund</option>
                <option>Manual correction</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[rgb(var(--ink))]">Note (optional)</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
                rows={2}
                maxLength={140}
                disabled={!canAdjust}
              />
              <p className="text-[10px] text-[rgb(var(--muted))]">{note.length}/140</p>
            </div>
            <button
              type="submit"
              disabled={!canAdjust || adjustLoading}
              className="rounded-full bg-[rgb(var(--ink))] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-black/30"
            >
              {adjustLoading ? "Applying..." : OPS_COPY.applyCredit}
            </button>
          </form>
        </div>

        <div className="space-y-3 rounded-xl border border-black/10 bg-white/70 p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-[rgb(var(--ink))]">{OPS_COPY.supportLink}</p>
          </div>
          {linkError ? (
            <ErrorBanner
              title={OPS_COPY.linkError}
              message={linkError.message ?? OPS_COPY.linkError}
              requestId={linkError.requestId ?? undefined}
              supportSnippet={supportSnippet(linkError.requestId, "Generate support link", linkError.code)}
            />
          ) : null}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[rgb(var(--ink))]">Destination</label>
            <select
              value={linkKind}
              onChange={(e) => setLinkKind(e.target.value as SupportLinkKind)}
              className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
            >
              <option value="billing">Billing (packs/subscription/portal)</option>
              <option value="application">Application (Outreach / Offer pack / Outcomes)</option>
              <option value="interview">Interview (Focus session)</option>
            </select>
          </div>
          {linkKind === "billing" ? (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-[rgb(var(--ink))]">Billing target</label>
              <select
                value={billingTarget}
                onChange={(e) =>
                  setBillingTarget(
                    e.target.value as "compare" | "subscription_30" | "subscription_80" | "pack_starter" | "pack_pro" | "pack_power" | "portal_return"
                  )
                }
                className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
              >
                <option value="compare">Compare plans</option>
                <option value="subscription_30">Subscription (Monthly 30)</option>
                <option value="subscription_80">Subscription (Monthly 80)</option>
                <option value="pack_starter">Top-up Starter</option>
                <option value="pack_pro">Top-up Pro</option>
                <option value="pack_power">Top-up Power</option>
                <option value="portal_return">Portal return</option>
              </select>
              {billingTarget === "portal_return" ? (
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-[rgb(var(--ink))]">Flow (optional)</label>
                  <input
                    value={billingFlow}
                    onChange={(e) => setBillingFlow(e.target.value)}
                    className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
                    placeholder="e.g. cancel"
                  />
                  <p className="text-[10px] text-[rgb(var(--muted))]">Portal flag is added automatically.</p>
                </div>
              ) : null}
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-[rgb(var(--ink))]">
                  {linkKind === "interview" ? "Application (optional)" : "Application"}
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAppSelectionMode("recent")}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                      appSelectionMode === "recent"
                        ? "border-[rgb(var(--ink))] bg-[rgb(var(--ink))] text-white"
                        : "border-black/10 bg-white text-[rgb(var(--ink))]"
                    }`}
                  >
                    Most recent active
                  </button>
                  <button
                    type="button"
                    onClick={() => setAppSelectionMode("choose")}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                      appSelectionMode === "choose"
                        ? "border-[rgb(var(--ink))] bg-[rgb(var(--ink))] text-white"
                        : "border-black/10 bg-white text-[rgb(var(--ink))]"
                    }`}
                  >
                    Choose from list
                  </button>
                  <button
                    type="button"
                    onClick={() => setAppSelectionMode("manual")}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                      appSelectionMode === "manual"
                        ? "border-[rgb(var(--ink))] bg-[rgb(var(--ink))] text-white"
                        : "border-black/10 bg-white text-[rgb(var(--ink))]"
                    }`}
                  >
                    Paste app ID
                  </button>
                </div>
                {appSelectionMode === "choose" ? (
                  <select
                    value={linkApplicationId}
                    onChange={(e) => setLinkApplicationId(e.target.value)}
                    className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
                  >
                    <option value="">Select application</option>
                    {applicationOptions.map((app) => (
                      <option key={app.id} value={app.id}>
                        {app.label}
                      </option>
                    ))}
                  </select>
                ) : null}
                {appSelectionMode === "manual" ? (
                  <input
                    value={manualAppId}
                    onChange={(e) => setManualAppId(e.target.value)}
                    className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
                    placeholder="app_xxx..."
                  />
                ) : null}
                {selectedApplicationId && appSelectionMode !== "recent" ? (
                  <p className="text-[10px] text-[rgb(var(--muted))]">Selected: {selectedApplicationLabel}</p>
                ) : null}
                {appSelectionMode === "recent" ? (
                  <p className="text-[10px] text-[rgb(var(--muted))]">
                    {recentActiveApplication
                      ? `Using ${recentActiveApplication.title}${recentActiveApplication.company ? ` · ${recentActiveApplication.company}` : ""}${
                          recentActiveApplication.status ? ` (${recentActiveApplication.status})` : ""
                        }`
                      : "No applications found."}
                  </p>
                ) : null}
                {linkKind === "interview" && !selectedApplicationId ? (
                  <p className="text-[10px] text-[rgb(var(--muted))]">No app selected — link will open the interview page.</p>
                ) : null}
              </div>
              {linkKind === "application" ? (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[rgb(var(--ink))]">Focus</label>
                  <select
                    value={linkFocus}
                    onChange={(e) => setLinkFocus(e.target.value as SupportFocus)}
                    className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
                  >
                    <option value="outreach">Outreach</option>
                    <option value="offer-pack">Offer pack</option>
                    <option value="outcome">Outcomes</option>
                  </select>
                </div>
              ) : (
                <p className="text-[10px] text-[rgb(var(--muted))]">Focuses on Interview Focus Session.</p>
              )}
            </>
          )}
          <p className="text-[10px] text-[rgb(var(--muted))]">Links include from=ops_support&support=1</p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleGenerateLink}
              disabled={linkLoading || (linkKind === "application" && !selectedApplicationId)}
              className="rounded-full bg-[rgb(var(--ink))] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-black/30"
            >
              {linkLoading ? "Generating..." : "Generate link"}
            </button>
            {lastGeneratedAt ? (
              <span className="text-[11px] text-[rgb(var(--muted))]">
                {OPS_COPY.supportLinkReady} · {lastGeneratedAt.toLocaleTimeString()}
              </span>
            ) : null}
          </div>
          {linkUrl ? (
            <div className="space-y-2">
              <div className="rounded-lg border border-black/10 bg-white px-3 py-2 text-xs text-[rgb(var(--ink))]">
                <input
                  ref={linkRef}
                  value={linkUrl}
                  readOnly
                  className="w-full bg-transparent text-xs font-mono"
                  onFocus={(e) => e.currentTarget.select()}
                />
              </div>
              {copyBlocked ? <ErrorBanner title={OPS_COPY.copyBlocked} message={OPS_COPY.copyBlocked} /> : null}
              <div className="flex flex-wrap items-center gap-2">
                <CopyIconButton
                  text={linkUrl}
                  label={OPS_COPY.copyLink}
                  onCopy={handleCopy}
                />
                <button
                  type="button"
                  className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-[rgb(var(--ink))]"
                  onClick={() => window.open(linkUrl, "_blank", "noopener,noreferrer")}
                >
                  Open link
                </button>
                <button
                  type="button"
                  className="text-xs font-semibold text-[rgb(var(--ink))] underline-offset-2 hover:underline"
                  onClick={handleGenerateLink}
                >
                  Regenerate
                </button>
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-[rgb(var(--muted))]">No support link yet.</p>
          )}
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-black/10 bg-white/70 p-3">
        <p className="text-sm font-semibold text-[rgb(var(--ink))]">{OPS_COPY.recentAudit}</p>
        {auditEntries.length === 0 ? (
          <p className="mt-2 text-xs text-[rgb(var(--muted))]">No recent ops actions.</p>
        ) : (
          <ul className="mt-2 space-y-2 text-xs text-[rgb(var(--muted))]">
            {auditEntries.map((entry) => (
              <li key={entry.id} className="flex flex-col rounded-lg border border-black/5 bg-white px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[rgb(var(--ink))]">
                  <span className="font-semibold">{entry.action}</span>
                  <span className="text-[10px]">{new Date(entry.createdAt).toLocaleString()}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-[10px]">
                  <span>Actor: {entry.actor ?? "unknown"}</span>
                  {entry.meta?.requestId ? (
                    <span className="flex items-center gap-1">
                      Ref: {entry.meta.requestId}
                      <CopyIconButton text={entry.meta.requestId} label={OPS_COPY.copyLink} />
                    </span>
                  ) : null}
                  {entry.meta?.note ? <span>Note: {entry.meta.note}</span> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
