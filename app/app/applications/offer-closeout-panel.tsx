"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { buildMailto } from "@/lib/outreach-mailto";
import { buildCloseoutList, buildWithdrawalTemplates, type CloseoutApp } from "@/lib/offer-closeout";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";

type Props = {
  applicationId: string;
  weekKey: string;
  apps: CloseoutApp[];
};

export default function OfferCloseoutPanel({ applicationId, weekKey, apps }: Props) {
  const [dismissed, setDismissed] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [loggedIds, setLoggedIds] = useState<Record<string, boolean>>({});
  const [decisionAccepted, setDecisionAccepted] = useState(false);
  const [variant, setVariant] = useState<"warm" | "direct" | "short">("warm");
  const dismissKey = useMemo(() => `cvf:offer-closeout-dismissed:${applicationId}:${weekKey}`, [applicationId, weekKey]);
  const decisionKey = useMemo(() => `cvf:offer-pack:${applicationId}`, [applicationId]);
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(dismissKey) === "true") {
      setDismissed(true);
    }
    const raw = window.localStorage.getItem(decisionKey);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed?.decision === "accepted") {
          setDecisionAccepted(true);
        }
      } catch {
        /* ignore */
      }
    }
  }, [decisionKey, dismissKey]);

  const list = useMemo(() => buildCloseoutList(apps, applicationId), [apps, applicationId]);
  const templates = buildWithdrawalTemplates({});

  useEffect(() => {
    if (decisionAccepted && list.length && !dismissed) {
      logMonetisationClientEvent("offer_closeout_view", applicationId, "applications");
    }
  }, [applicationId, decisionAccepted, dismissed, list.length]);

  if (!decisionAccepted || dismissed || list.length === 0) return null;

  const toggleSelect = (id: string, value: boolean) => {
    setSelected((prev) => ({ ...prev, [id]: value }));
    logMonetisationClientEvent("offer_closeout_select_app", id, "applications");
  };

  const selectAll = (value: boolean) => {
    const next: Record<string, boolean> = {};
    list.forEach((item) => {
      next[item.id] = value;
    });
    setSelected(next);
    logMonetisationClientEvent("offer_closeout_select_all", applicationId, "applications");
  };

  const markClosed = async (ids: string[]) => {
    setErrors((prev) => {
      const next = { ...prev };
      ids.forEach((id) => delete next[id]);
      return next;
    });
    setSaving((prev) => {
      const next = { ...prev };
      ids.forEach((id) => (next[id] = true));
      return next;
    });
    for (const id of ids) {
      try {
        const res = await fetch("/api/outcomes/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            applicationId: id,
            status: "rejected",
            reason: "accepted_other_offer",
          }),
        });
        if (!res.ok) {
          throw new Error("fail");
        }
        setLoggedIds((prev) => ({ ...prev, [id]: true }));
        logMonetisationClientEvent("offer_closeout_outcome_logged", id, "applications");
      } catch (error) {
        logMonetisationClientEvent("offer_closeout_outcome_failed", id, "applications");
        setErrors((prev) => ({ ...prev, [id]: true }));
      } finally {
        setSaving((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    }
  };

  const selectedIds = Object.entries(selected)
    .filter(([, v]) => v)
    .map(([k]) => k);

  const copyTemplate = (text: string, id: string) => {
    navigator.clipboard.writeText(text).catch(() => undefined);
    logMonetisationClientEvent("offer_withdrawal_copy", id, "applications", { variant });
  };

  const openGmail = (item: CloseoutApp, body: string) => {
    if (!item.contactEmail) {
      logMonetisationClientEvent("offer_withdrawal_contact_missing", item.id, "applications");
      return;
    }
    const href = buildMailto({
      email: item.contactEmail,
      subject: templates[variant].subject,
      body,
    });
    logMonetisationClientEvent("offer_withdrawal_send_gmail", item.id, "applications", { variant });
    if (body.length > 1500) {
      navigator.clipboard.writeText(body).catch(() => undefined);
    }
    window.location.href = href;
  };

  const openLinkedIn = (item: CloseoutApp) => {
    if (!item.contactLinkedin) {
      logMonetisationClientEvent("offer_withdrawal_contact_missing", item.id, "applications");
      return;
    }
    logMonetisationClientEvent("offer_withdrawal_send_linkedin", item.id, "applications", { variant });
    window.open(item.contactLinkedin, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="rounded-3xl border border-black/10 bg-gradient-to-br from-white via-white to-amber-50 p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[rgb(var(--muted))]">Close out the rest (5 minutes)</p>
          <p className="text-sm text-[rgb(var(--muted))]">Select applications to close and send polite withdrawals.</p>
        </div>
        <button
          type="button"
          className="text-xs font-semibold text-[rgb(var(--ink))] underline-offset-2 hover:underline"
          onClick={() => {
            setDismissed(true);
            if (typeof window !== "undefined") {
              window.localStorage.setItem(dismissKey, "true");
            }
            logMonetisationClientEvent("offer_closeout_dismiss", applicationId, "applications");
          }}
        >
          Not now
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="rounded-full border border-black/10 bg-white px-3 py-1 text-[10px] font-semibold text-[rgb(var(--ink))]"
          onClick={() => selectAll(true)}
        >
          Select all
        </button>
        <button
          type="button"
          className="rounded-full border border-black/10 bg-white px-3 py-1 text-[10px] font-semibold text-[rgb(var(--ink))]"
          onClick={() => markClosed(selectedIds)}
          disabled={!selectedIds.length}
        >
          Mark selected closed
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {(["warm", "direct", "short"] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setVariant(key);
              logMonetisationClientEvent("offer_withdrawal_variant_change", applicationId, "applications", { variant: key });
            }}
            className={`rounded-full px-3 py-1 text-[10px] font-semibold ${
              variant === key ? "bg-[rgb(var(--ink))] text-white" : "border border-black/10 bg-white text-[rgb(var(--ink))]"
            }`}
          >
            {key === "warm" ? "Warm" : key === "direct" ? "Direct" : "Short"}
          </button>
        ))}
      </div>

      <div className="mt-3 space-y-3">
        {list.map((item) => {
      const template = buildWithdrawalTemplates({
        role: item.role,
        company: item.company,
      })[variant];
      return (
        <div key={item.id} className="rounded-2xl border border-black/10 bg-white/80 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <input
                    type="checkbox"
                    checked={Boolean(selected[item.id])}
                    onChange={(e) => toggleSelect(item.id, e.target.checked)}
                  />
                  <div>
                    <p className="text-sm font-semibold text-[rgb(var(--ink))]">
                      {item.role} · {item.company}
                    </p>
                    <p className="text-[11px] uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
                      {item.status}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {item.outreachStage ? (
                    <span className="rounded-full bg-blue-100 px-2 py-1 text-[10px] font-semibold text-blue-700">Outreach scheduled</span>
                  ) : null}
                  {item.nextActionDue ? (
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-700">Next action due</span>
                  ) : null}
                </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="rounded-full border border-black/10 bg-white px-3 py-1 text-[10px] font-semibold text-[rgb(var(--ink))]"
                onClick={() => markClosed([item.id])}
                disabled={Boolean(saving[item.id])}
              >
                {saving[item.id] ? "Saving…" : loggedIds[item.id] ? "Logged" : "Mark closed"}
              </button>
              {item.contactEmail ? (
                <button
                  type="button"
                  className="rounded-full border border-black/10 bg-white px-3 py-1 text-[10px] font-semibold text-[rgb(var(--ink))]"
                  onClick={() => openGmail(item, template.body)}
                >
                  Send Gmail
                </button>
              ) : (
                <Link
                  href={`/app/applications/${item.id}?tab=activity#outreach`}
                  className="rounded-full border border-black/10 bg-white px-3 py-1 text-[10px] font-semibold text-[rgb(var(--ink))]"
                  onClick={() =>
                    logMonetisationClientEvent("offer_withdrawal_contact_missing", item.id, "applications")
                  }
                >
                  Add contact
                </Link>
              )}
              {item.contactLinkedin ? (
                <button
                  type="button"
                  className="rounded-full border border-black/10 bg-white px-3 py-1 text-[10px] font-semibold text-[rgb(var(--ink))]"
                  onClick={() => openLinkedIn(item)}
                  >
                    Send LinkedIn
                  </button>
                ) : null}
                <button
                  type="button"
                  className="rounded-full border border-black/10 bg-white px-3 py-1 text-[10px] font-semibold text-[rgb(var(--ink))]"
                  onClick={() => copyTemplate(template.body, item.id)}
                >
                  Copy
                </button>
              <Link
                href={`/app/applications/${item.id}?tab=activity#outreach`}
                className="text-[10px] font-semibold text-[rgb(var(--accent-strong))] underline-offset-2 hover:underline"
              >
                Open app
              </Link>
              {errors[item.id] ? (
                <button
                  type="button"
                  className="text-[10px] font-semibold text-rose-700 underline-offset-2 hover:underline"
                  onClick={() => markClosed([item.id])}
                >
                  Retry
                </button>
              ) : null}
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
}
