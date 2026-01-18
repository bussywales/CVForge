"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { buildOutreachVariants } from "@/lib/outreach-variants";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";
import { buildMailto } from "@/lib/outreach-mailto";

type FollowupModalProps = {
  item: {
    id: string;
    role: string;
    company: string;
    contactEmail?: string | null;
    contactLinkedin?: string | null;
    href: string;
    isRecovery?: boolean;
  };
  onClose: () => void;
  onLogged?: () => void;
};

export default function FollowupModal({ item, onClose, onLogged }: FollowupModalProps) {
  const variants = useMemo(
    () =>
      buildOutreachVariants({
        role: item.role,
        company: item.company,
        contactName: undefined,
        stage: "followup",
        triage: undefined,
      }),
    [item.company, item.role]
  );
  const [variantKey, setVariantKey] = useState<string>(
    item.isRecovery ? "polite" : variants[0]?.key ?? "polite"
  );
  const [note, setNote] = useState("");
  const [scheduled, setScheduled] = useState<string | null>(null);

  const variant = variants.find((v) => v.key === variantKey) ?? variants[0];
  const mailto = item.contactEmail
    ? buildMailto({
        email: item.contactEmail,
        subject: variant?.subject ?? `Re: ${item.role}`,
        body: variant?.body ?? "",
      })
    : null;

  const handleCopy = () => {
    if (!variant) return;
    navigator.clipboard.writeText(variant.body).catch(() => undefined);
    logMonetisationClientEvent("followup_modal_copy", item.id, "applications", { variant: variant.key });
  };

  const handleGmail = () => {
    if (!mailto) return;
    logMonetisationClientEvent("followup_modal_gmail_open", item.id, "applications", { variant: variant?.key });
    if ((variant?.body ?? "").length > 1500) {
      navigator.clipboard.writeText(variant?.body ?? "").catch(() => undefined);
    }
    window.location.href = mailto;
  };

  const handleLinkedIn = () => {
    if (!item.contactLinkedin) return;
    logMonetisationClientEvent("followup_modal_linkedin_open", item.id, "applications", { variant: variant?.key });
    window.open(item.contactLinkedin, "_blank", "noopener,noreferrer");
  };

  const handleSave = () => {
    logMonetisationClientEvent("followup_modal_log_sent", item.id, "applications", {
      variant: variant?.key,
      scheduled,
    });
    logMonetisationClientEvent("followup_modal_save_success", item.id, "applications", {
      scheduled,
    });
    onLogged?.();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-lg">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-[rgb(var(--ink))]">Follow-up autopilot</p>
          <button
            type="button"
            className="text-xs font-semibold text-[rgb(var(--ink))] underline-offset-2 hover:underline"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <p className="text-xs text-[rgb(var(--muted))]">
          {item.role} · {item.company}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {variants.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => {
                setVariantKey(v.key);
                logMonetisationClientEvent("followup_modal_view", item.id, "applications", { variant: v.key });
              }}
              className={`rounded-full px-3 py-1 text-[10px] font-semibold ${
                v.key === variantKey ? "bg-[rgb(var(--ink))] text-white" : "border border-black/10 bg-white text-[rgb(var(--ink))]"
              }`}
            >
              {v.key === "polite" ? "Polite" : v.key === "direct" ? "Direct" : "Warm"}
            </button>
          ))}
        </div>
        {variant ? (
          <pre className="mt-3 whitespace-pre-wrap rounded-2xl border border-black/10 bg-white/70 p-3 text-sm text-[rgb(var(--muted))]">
            {variant.body}
          </pre>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded-full border border-black/10 bg-white px-3 py-1 text-[10px] font-semibold text-[rgb(var(--ink))]"
            onClick={handleCopy}
          >
            Copy
          </button>
          {item.contactEmail ? (
            <button
              type="button"
              className="rounded-full border border-black/10 bg-white px-3 py-1 text-[10px] font-semibold text-[rgb(var(--ink))]"
              onClick={handleGmail}
            >
              Open Gmail
            </button>
          ) : (
            <Link
              href={item.href}
              className="rounded-full border border-black/10 bg-white px-3 py-1 text-[10px] font-semibold text-[rgb(var(--ink))]"
            >
              Add contact
            </Link>
          )}
          {item.contactLinkedin ? (
            <button
              type="button"
              className="rounded-full border border-black/10 bg-white px-3 py-1 text-[10px] font-semibold text-[rgb(var(--ink))]"
              onClick={handleLinkedIn}
            >
              Open LinkedIn
            </button>
          ) : null}
        </div>
        <div className="mt-3 space-y-2 text-sm text-[rgb(var(--muted))]">
          <p className="text-xs font-semibold text-[rgb(var(--ink))]">After sending</p>
          <div className="flex flex-wrap items-center gap-2">
            {[
              { label: "In 2 business days", key: "2d" },
              { label: "In 5 business days", key: "5d" },
              { label: "In 7 days", key: "7d" },
            ].map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setScheduled(opt.key)}
                className={`rounded-full px-3 py-1 text-[10px] font-semibold ${
                  scheduled === opt.key ? "bg-[rgb(var(--ink))] text-white" : "border border-black/10 bg-white text-[rgb(var(--ink))]"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <textarea
            className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm"
            placeholder="Notes (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded-full bg-[rgb(var(--ink))] px-4 py-2 text-xs font-semibold text-white"
            onClick={handleSave}
          >
            Log sent + schedule
          </button>
          <button
            type="button"
            className="text-xs font-semibold text-[rgb(var(--ink))] underline-offset-2 hover:underline"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
