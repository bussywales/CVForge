"use client";

import { useEffect, useMemo, useState } from "react";
import CopyIconButton from "@/components/CopyIconButton";
import ErrorBanner from "@/components/ErrorBanner";
import { OPS_COPY } from "@/lib/microcopy/ops";
import { buildSupportSnippet } from "@/lib/observability/support-snippet";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";
import { safeReadJson } from "@/lib/http/safe-json";
import { type SupportLinkKind } from "@/lib/ops/support-links";
import { type UserRole } from "@/lib/rbac";

type ApplicationOption = { id: string; title: string; company?: string | null };
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

  const [linkKind, setLinkKind] = useState<SupportLinkKind>("billing_compare");
  const [linkApplicationId, setLinkApplicationId] = useState<string>("");
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<{ requestId?: string | null; message?: string | null; code?: string | null } | null>(null);
  const [linkLoading, setLinkLoading] = useState(false);

  const canAdjust = viewerRole === "admin" || viewerRole === "super_admin";

  useEffect(() => {
    logMonetisationClientEvent("ops_credit_adjust_view", targetUserId, "ops");
  }, [targetUserId]);

  const applicationOptions = useMemo(
    () =>
      applications.map((app) => ({
        id: app.id,
        label: `${app.title}${app.company ? ` · ${app.company}` : ""}`,
      })),
    [applications]
  );

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
    setLinkUrl(null);
    logMonetisationClientEvent("ops_support_link_generate", targetUserId, "ops", { kind: linkKind });
    const res = await fetch("/api/ops/support-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: targetUserId,
        kind: linkKind,
        applicationId: linkKind === "application" ? linkApplicationId || null : undefined,
      }),
    });
    const { data } = await safeReadJson(res);
    const reqId = res.headers.get("x-request-id") ?? data?.error?.requestId;
    if (!res.ok) {
      setLinkError({ requestId: reqId, message: data?.error?.message ?? OPS_COPY.linkError, code: data?.error?.code });
      logMonetisationClientEvent("ops_support_link_copy", targetUserId, "ops", { error: true, kind: linkKind });
      setLinkLoading(false);
      return;
    }
    setLinkUrl(data?.url ?? null);
    setLinkLoading(false);
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
              <option value="billing_compare">Billing → Compare</option>
              <option value="billing_subscription_30">Billing → Subscription (Monthly 30)</option>
              <option value="billing_subscription_80">Billing → Subscription (Monthly 80)</option>
              <option value="billing_topup_starter">Billing → Top-up Starter</option>
              <option value="billing_topup_pro">Billing → Top-up Pro</option>
              <option value="billing_topup_power">Billing → Top-up Power</option>
              <option value="application">Application → Specific tab</option>
            </select>
          </div>
          {linkKind === "application" ? (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[rgb(var(--ink))]">Application</label>
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
              <p className="text-[10px] text-[rgb(var(--muted))]">Links include from=ops_support&support=1</p>
            </div>
          ) : null}
          <button
            type="button"
            onClick={handleGenerateLink}
            disabled={linkLoading || (linkKind === "application" && !linkApplicationId)}
            className="rounded-full bg-[rgb(var(--ink))] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-black/30"
          >
            {linkLoading ? "Generating..." : "Generate link"}
          </button>
          {linkUrl ? (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-black/10 bg-white px-3 py-2 text-xs text-[rgb(var(--ink))]">
              <span className="line-clamp-2 break-all">{linkUrl}</span>
              <CopyIconButton
                text={linkUrl}
                label={OPS_COPY.copyLink}
                onCopy={() => logMonetisationClientEvent("ops_support_link_copy", targetUserId, "ops", { kind: linkKind })}
              />
            </div>
          ) : null}
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
