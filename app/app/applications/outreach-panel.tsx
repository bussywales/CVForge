"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import Button from "@/components/Button";
import { OUTREACH_COPY } from "@/lib/outreach-microcopy";
import { describeFollowupStatus, type OutreachRecommendation } from "@/lib/outreach-engine";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";
import {
  createFollowupFromTemplateAction,
  scheduleFollowupAction,
  markOutreachRepliedAction,
  closeOutreachAction,
} from "./actions";
import { useEffect } from "react";
import { buildMailto, isValidEmail, isValidLinkedIn } from "@/lib/outreach-mailto";
import { logOutreachTriageAction } from "./actions";
import { buildNextMove } from "@/lib/outreach-next-move";
import OutcomeQuickLog from "@/components/OutcomeQuickLog";
import { buildOutreachVariants } from "@/lib/outreach-variants";

type OutreachPanelProps = {
  applicationId: string;
  statusLabel: string;
  recommendation: OutreachRecommendation | null;
  nextDue?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactLinkedin?: string | null;
  jobTitle?: string | null;
  company?: string | null;
  triageStatus?: string | null;
  triageNotes?: string | null;
  nextMove?: { key: string; label: string; href: string; why: string } | null;
};

export default function OutreachPanel({
  applicationId,
  statusLabel,
  recommendation,
  nextDue,
  contactName,
  contactEmail,
  contactLinkedin,
  jobTitle,
  company,
  triageStatus,
  triageNotes,
  nextMove,
}: OutreachPanelProps) {
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedOutcome, setSelectedOutcome] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [editingContact, setEditingContact] = useState(false);
  const [contactForm, setContactForm] = useState({
    name: contactName ?? "",
    email: contactEmail ?? "",
    linkedin: contactLinkedin ?? "",
  });
  const [contactError, setContactError] = useState<string | null>(null);
  const [contactSaving, setContactSaving] = useState(false);
  const [triage, setTriage] = useState<string | null>(triageStatus ?? null);
  const [triageNote, setTriageNote] = useState(triageNotes ?? "");
  const [triageMessage, setTriageMessage] = useState<string | null>(null);
  const variants = useMemo(
    () =>
      buildOutreachVariants({
        role: jobTitle,
        company,
        contactName,
        stage: recommendation?.stage,
        triage: triageStatus ?? undefined,
      }),
    [company, contactName, jobTitle, recommendation?.stage, triageStatus]
  );
  const storageKey = useMemo(
    () => `cvf:outreach_variant:${applicationId}`,
    [applicationId]
  );
  const [variantKey, setVariantKey] = useState<string>(variants[0]?.key ?? "polite");
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(storageKey, variantKey);
  }, [storageKey, variantKey]);

  const subject = recommendation?.subject ?? "";
  const dueLabel = describeFollowupStatus(nextDue ?? recommendation?.dueAt);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(storageKey);
    if (raw) {
      setVariantKey(raw);
    }
  }, [storageKey]);

  const selectedVariant = variants.find((v) => v.key === variantKey) ?? variants[0];

  useEffect(() => {
    if (!selectedVariant) return;
    setMessage(selectedVariant.body);
    logMonetisationClientEvent("outreach_quality_shown", applicationId, "applications", {
      variant: selectedVariant.key,
      quality: selectedVariant.quality,
    });
    logMonetisationClientEvent("outreach_variant_view", applicationId, "applications", {
      variant: selectedVariant.key,
    });
  }, [applicationId, selectedVariant]);

  useEffect(() => {
    logMonetisationClientEvent("outreach_panel_view", applicationId, "applications", {
      stage: recommendation?.stage,
    });
  }, [applicationId, recommendation?.stage]);
  useEffect(() => {
    if (nextMove) {
      logMonetisationClientEvent("outreach_next_move_view", applicationId, "applications", {
        key: nextMove.key,
      });
    }
  }, [applicationId, nextMove]);
  useEffect(() => {
    logMonetisationClientEvent("outreach_triage_view", applicationId, "applications", {});
  }, [applicationId]);
  useEffect(() => {
    setTriage(triageStatus ?? null);
    setTriageNote(triageNotes ?? "");
  }, [triageStatus, triageNotes]);

  const handleCopy = async () => {
    if (!selectedVariant) return;
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      logMonetisationClientEvent("outreach_variant_copy", applicationId, "applications", {
        stage: recommendation?.stage,
        variant: selectedVariant.key,
      });
      setTimeout(() => setCopied(false), 2500);
    } catch (error) {
      console.error("[outreach.copy]", error);
    }
  };

  const handleSchedule = () => {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("application_id", applicationId);
      await scheduleFollowupAction(formData);
      logMonetisationClientEvent("outreach_schedule_next", applicationId, "applications", {});
    });
  };

  const handleSaveContact = async () => {
    setContactError(null);
    setContactSaving(true);
    try {
      if (contactForm.email && !isValidEmail(contactForm.email)) {
        setContactError("Enter a valid email.");
        return;
      }
      if (contactForm.linkedin && !isValidLinkedIn(contactForm.linkedin)) {
        setContactError("Enter a valid LinkedIn URL.");
        return;
      }
      const res = await fetch(`/api/applications/${applicationId}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: contactForm.name.trim() || null,
          email: contactForm.email.trim() || null,
          linkedin_url: contactForm.linkedin.trim() || null,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload.ok) {
        setContactError(payload?.error ?? "Unable to save contact.");
        return;
      }
      setEditingContact(false);
      logMonetisationClientEvent("outreach_contact_save", applicationId, "applications", {});
    } catch (error) {
      console.error("[outreach.contact.save]", error);
      setContactError("Unable to save contact.");
    } finally {
      setContactSaving(false);
    }
  };

  const mailtoHref = useMemo(() => {
    if (!contactEmail || !message) return null;
    const sub =
      selectedVariant?.subject ||
      subject ||
      `Re: ${jobTitle ?? "Role"}${company ? ` at ${company}` : ""}`;
    return buildMailto({
      email: contactEmail,
      subject: sub,
      body: message,
    });
  }, [contactEmail, message, subject, selectedVariant?.subject, jobTitle, company]);

  const handleOpenMail = () => {
    if (!mailtoHref) {
      logMonetisationClientEvent("outreach_send_blocked_no_contact", applicationId, "applications", {});
      return;
    }
    logMonetisationClientEvent("outreach_send_gmail", applicationId, "applications", {
      variant: selectedVariant?.key,
    });
    const tooLong = message.length > 1500;
    if (tooLong) {
      void navigator.clipboard.writeText(message).catch(() => undefined);
      logMonetisationClientEvent("outreach_mailto_long_copy", applicationId, "applications", {});
    }
    window.location.href = mailtoHref;
  };

  const handleOpenLinkedIn = () => {
    if (!contactLinkedin) {
      logMonetisationClientEvent("outreach_send_blocked_no_contact", applicationId, "applications", {});
      return;
    }
    logMonetisationClientEvent("outreach_send_linkedin", applicationId, "applications", {
      variant: selectedVariant?.key,
    });
    window.open(contactLinkedin, "_blank", "noopener,noreferrer");
  };

  const handleTriageSave = () => {
    if (!triage) return;
    const fd = new FormData();
    fd.set("application_id", applicationId);
    fd.set("triage_status", triage);
    fd.set("notes", triageNote);
    logMonetisationClientEvent("outreach_triage_select", applicationId, "applications", {
      triage,
    });
    startTransition(async () => {
      const result = await logOutreachTriageAction(fd);
      setTriageMessage(result?.message ?? null);
    });
  };

  const quickOutcome = async (status: string, reason?: string) => {
    try {
      const res = await fetch("/api/outcomes/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId,
          status,
          reason,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (res.ok && payload?.ok) {
        logMonetisationClientEvent("outreach_outcome_quicklog_success", applicationId, "applications", {
          status,
        });
        setTriageMessage("Outcome logged.");
      } else {
        logMonetisationClientEvent("outreach_outcome_quicklog_fail", applicationId, "applications", {
          status,
        });
        setTriageMessage(payload?.error ?? "Unable to log outcome.");
      }
    } catch (error) {
      console.error("[outreach.quickOutcome]", error);
      setTriageMessage("Unable to log outcome.");
    }
  };

  const handleOutcome = (value: string | null) => {
    setSelectedOutcome(value);
    if (!value) return;
    startTransition(async () => {
      if (value === "reply") {
        const formData = new FormData();
        formData.set("application_id", applicationId);
        await markOutreachRepliedAction(formData);
      } else if (value === "not_relevant") {
        const formData = new FormData();
        formData.set("application_id", applicationId);
        await closeOutreachAction(formData);
      }
    });
  };

  return (
    <div id="outreach" className="rounded-3xl border border-black/10 bg-white/80 p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
            {OUTREACH_COPY.TITLE}
          </p>
          <p className="mt-1 text-sm text-[rgb(var(--muted))]">
            {OUTREACH_COPY.SUBTITLE}
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-600">
          {statusLabel}
        </span>
      </div>

      <div className="mt-4 rounded-2xl border border-dashed border-black/10 bg-white/60 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold text-[rgb(var(--muted))]">Contact</p>
          <button
            type="button"
            onClick={() => {
              setEditingContact(true);
              logMonetisationClientEvent("outreach_contact_edit", applicationId, "applications", {});
            }}
            className="text-xs font-semibold text-[rgb(var(--ink))] underline-offset-2 hover:underline"
          >
            {contactEmail || contactLinkedin ? "Edit" : "Add"}
          </button>
        </div>
        {editingContact || (!contactEmail && !contactLinkedin) ? (
          <div className="mt-2 space-y-2">
            <input
              type="text"
              placeholder="Name (optional)"
              value={contactForm.name}
              onChange={(event) =>
                setContactForm((prev) => ({ ...prev, name: event.target.value }))
              }
              className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm"
            />
            <input
              type="email"
              placeholder="Email"
              value={contactForm.email}
              onChange={(event) =>
                setContactForm((prev) => ({ ...prev, email: event.target.value }))
              }
              className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm"
            />
            <input
              type="url"
              placeholder="LinkedIn URL"
              value={contactForm.linkedin}
              onChange={(event) =>
                setContactForm((prev) => ({ ...prev, linkedin: event.target.value }))
              }
              className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm"
            />
            {contactError ? (
              <p className="text-xs text-rose-700">{contactError}</p>
            ) : (
              <p className="text-xs text-[rgb(var(--muted))]">
                Add a contact so CVForge can open the right channel for you.
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" onClick={handleSaveContact} disabled={contactSaving}>
                Save contact
              </Button>
              {contactEmail || contactLinkedin ? (
                <button
                  type="button"
                  onClick={() => setEditingContact(false)}
                  className="text-xs font-semibold text-[rgb(var(--ink))] underline-offset-2 hover:underline"
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="mt-2 space-y-1 text-sm text-[rgb(var(--muted))]">
            {contactName ? <p>{contactName}</p> : null}
            {contactEmail ? <p>{contactEmail}</p> : null}
            {contactLinkedin ? (
              <p>{new URL(contactLinkedin).hostname.replace(/^www\./, "")}</p>
            ) : null}
          </div>
        )}
      </div>

      <div className="mt-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-[rgb(var(--muted))]">
          <span className="rounded-full bg-amber-100 px-3 py-1 text-[10px] font-semibold text-amber-700">
            {dueLabel}
          </span>
          {nextDue ? (
            <span className="text-[10px] text-[rgb(var(--muted))]">
              Next follow-up: {new Date(nextDue).toLocaleDateString()}
            </span>
          ) : null}
        </div>

        <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-[rgb(var(--muted))]">
              Reply triage
            </p>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {[
              { key: "interested", label: "Interested ✅" },
              { key: "not_now", label: "Not now ⏳" },
              { key: "rejected", label: "Rejected ❌" },
              { key: "no_response", label: "No response 👻" },
            ].map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setTriage(option.key)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                  triage === option.key
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-black/10 bg-white text-[rgb(var(--ink))]"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <textarea
            className="mt-3 w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm"
            placeholder="What did they say?"
            value={triageNote}
            onChange={(event) => setTriageNote(event.target.value)}
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button type="button" onClick={handleTriageSave} disabled={!triage || isPending}>
              {triage === "interested"
                ? "Prepare interview"
                : triage === "rejected"
                  ? "Log outcome"
                  : triage === "no_response"
                    ? "Send follow-up"
                    : "Schedule follow-up"}
            </Button>
            {triage === "interested" ? (
              <button
                type="button"
                onClick={() => quickOutcome("interviewing")}
                className="text-xs font-semibold text-[rgb(var(--ink))] underline-offset-2 hover:underline"
              >
                Quick log: interview scheduled
              </button>
            ) : null}
            {triage === "rejected" ? (
              <button
                type="button"
                onClick={() => quickOutcome("rejected", "recruiter_rejected")}
                className="text-xs font-semibold text-[rgb(var(--ink))] underline-offset-2 hover:underline"
              >
                Quick log: rejected
              </button>
            ) : null}
          </div>
          {triageMessage ? (
            <p className="mt-2 text-xs text-[rgb(var(--muted))]">{triageMessage}</p>
          ) : null}
        </div>

        <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {variants.map((variant) => (
                <button
                  key={variant.key}
                  type="button"
                  onClick={() => {
                    setVariantKey(variant.key);
                    setMessage(variant.body);
                    logMonetisationClientEvent("outreach_variant_select", applicationId, "applications", {
                      variant: variant.key,
                    });
                  }}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    variantKey === variant.key
                      ? "bg-[rgb(var(--ink))] text-white"
                      : "border border-black/10 bg-white text-[rgb(var(--ink))]"
                  }`}
                >
                  {variant.key === "polite"
                    ? OUTREACH_COPY.VARIANTS.POLITE
                    : variant.key === "direct"
                      ? OUTREACH_COPY.VARIANTS.DIRECT
                      : OUTREACH_COPY.VARIANTS.WARM}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[10px] text-[rgb(var(--muted))]">
              <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold">
                {OUTREACH_COPY.QUALITY_LABEL}: {selectedVariant?.reason ?? "Clear ask"}
              </span>
              {selectedVariant ? (
                <span className="flex flex-wrap items-center gap-1">
                  <ChipLabel value={selectedVariant.quality.lengthBand} />
                  {selectedVariant.quality.hasProof ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-1 font-semibold text-emerald-700">
                      {OUTREACH_COPY.QUALITY_CHIPS.PROOF}
                    </span>
                  ) : null}
                  {selectedVariant.quality.hasAsk ? (
                    <span className="rounded-full bg-blue-100 px-2 py-1 font-semibold text-blue-700">
                      {OUTREACH_COPY.QUALITY_CHIPS.ASK}
                    </span>
                  ) : null}
                </span>
              ) : null}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              {selectedVariant?.subject || subject ? (
                <p className="text-sm font-semibold text-[rgb(var(--ink))]">
                  {selectedVariant?.subject || subject}
                </p>
              ) : null}
              <p className="text-xs text-[rgb(var(--muted))]">
                {recommendation?.stage ? recommendation.stage.replace(/_/g, " ") : "Follow-up"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleOpenMail}
                className="rounded-full border border-black/10 bg-white px-3 py-1 text-[10px] font-semibold text-[rgb(var(--ink))]"
                disabled={!mailtoHref}
              >
                {contactEmail ? "Open Gmail" : "Add contact"}
              </button>
              {contactLinkedin ? (
                <button
                  type="button"
                  onClick={handleOpenLinkedIn}
                  className="rounded-full border border-black/10 bg-white px-3 py-1 text-[10px] font-semibold text-[rgb(var(--ink))]"
                >
                  Open LinkedIn
                </button>
              ) : null}
              <button
                type="button"
                onClick={handleCopy}
                className="rounded-full border border-black/10 bg-white px-3 py-1 text-[10px] font-semibold text-[rgb(var(--ink))]"
              >
                {copied ? "Copied" : OUTREACH_COPY.CTA_COPY}
              </button>
            </div>
          </div>
          <pre className="mt-3 whitespace-pre-wrap text-sm text-[rgb(var(--muted))]">
            {message}
          </pre>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <form
              action={createFollowupFromTemplateAction}
              onSubmit={() =>
                logMonetisationClientEvent(
                  "outreach_log_sent",
                  applicationId,
                  "applications",
                  { stage: recommendation?.stage, variant: selectedVariant?.key }
                )
              }
            >
              <input type="hidden" name="application_id" value={applicationId} />
              <input type="hidden" name="subject" value={selectedVariant?.subject || subject} />
              <input type="hidden" name="body" value={message} />
              <Button type="submit" disabled={isPending}>
                {OUTREACH_COPY.CTA_LOG}
              </Button>
            </form>
            <button
              type="button"
              onClick={handleSchedule}
              className="rounded-full border border-black/10 bg-white px-3 py-1 text-[10px] font-semibold text-[rgb(var(--ink))]"
              disabled={isPending}
            >
              {OUTREACH_COPY.CTA_SCHEDULE}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
          <p className="text-xs font-semibold text-[rgb(var(--muted))]">
            If they reply
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleOutcome("reply")}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                selectedOutcome === "reply"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-black/10 bg-white text-[rgb(var(--ink))]"
              }`}
            >
              Reply received
            </button>
            <button
              type="button"
              onClick={() => handleOutcome("no_reply")}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                selectedOutcome === "no_reply"
                  ? "border-slate-200 bg-slate-50 text-slate-700"
                  : "border-black/10 bg-white text-[rgb(var(--ink))]"
              }`}
            >
              No reply yet
            </button>
            <button
              type="button"
              onClick={() => handleOutcome("not_relevant")}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                selectedOutcome === "not_relevant"
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : "border-black/10 bg-white text-[rgb(var(--ink))]"
              }`}
            >
              Not relevant
            </button>
          </div>
          <textarea
            className="mt-3 w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm"
            placeholder="Notes (optional)"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
          <p className="mt-2 text-xs text-[rgb(var(--muted))]">
            If you received a reply, log the outcome next to keep pipeline stats tidy.
          </p>
          {triage === "interested" || triage === "rejected" ? (
            <div className="mt-3">
              <OutcomeQuickLog
                applicationId={applicationId}
                defaultStatus={triage === "rejected" ? "rejected" : "interview_scheduled"}
              />
            </div>
          ) : null}
        </div>
        {nextMove ? (
          <div className="rounded-2xl border border-black/10 bg-white/80 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
                  Next move
                </p>
                <p className="text-sm text-[rgb(var(--muted))]">{nextMove.why}</p>
              </div>
              <Link
                href={nextMove.href}
                className="rounded-full border border-black/10 bg-[rgb(var(--ink))] px-3 py-2 text-xs font-semibold text-white"
                onClick={() =>
                  logMonetisationClientEvent("outreach_next_move_click", applicationId, "applications", {
                    key: nextMove.key,
                  })
                }
              >
                {nextMove.label}
              </Link>
            </div>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[rgb(var(--muted))]">
          <span>{OUTREACH_COPY.QUEUE_EMPTY}</span>
          <Link
            href={`/app/applications/${applicationId}?tab=activity#activity-log`}
            className="text-[rgb(var(--ink))] underline-offset-2 hover:underline"
          >
            {OUTREACH_COPY.CTA_OPEN}
          </Link>
        </div>
      </div>
    </div>
  );
}

function ChipLabel({ value }: { value: string }) {
  const map: Record<string, string> = {
    short: OUTREACH_COPY.QUALITY_CHIPS.SHORT,
    medium: OUTREACH_COPY.QUALITY_CHIPS.MEDIUM,
    long: OUTREACH_COPY.QUALITY_CHIPS.LONG,
  };
  const label = map[value] ?? value;
  return (
    <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-[rgb(var(--muted))]">
      {label}
    </span>
  );
}
