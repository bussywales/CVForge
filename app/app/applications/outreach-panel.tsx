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

  const subject = recommendation?.subject ?? "";
  const body = recommendation?.body ?? "";
  const dueLabel = describeFollowupStatus(nextDue ?? recommendation?.dueAt);

  useMemo(() => {
    setMessage(body);
  }, [body]);

  useEffect(() => {
    logMonetisationClientEvent("outreach_panel_view", applicationId, "applications", {
      stage: recommendation?.stage,
    });
  }, [applicationId, recommendation?.stage]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      logMonetisationClientEvent("outreach_copy_click", applicationId, "applications", {
        stage: recommendation?.stage,
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
    const sub = subject || `Re: ${jobTitle ?? "Role"}${company ? ` at ${company}` : ""}`;
    return buildMailto({
      email: contactEmail,
      subject: sub,
      body: message,
    });
  }, [contactEmail, message, subject, jobTitle, company]);

  const handleOpenMail = () => {
    if (!mailtoHref) {
      logMonetisationClientEvent("outreach_contact_missing_block", applicationId, "applications", {});
      return;
    }
    logMonetisationClientEvent("outreach_open_gmail_click", applicationId, "applications", {});
    const tooLong = message.length > 1500;
    if (tooLong) {
      void navigator.clipboard.writeText(message).catch(() => undefined);
      logMonetisationClientEvent("outreach_mailto_fallback_copy", applicationId, "applications", {});
    }
    window.location.href = mailtoHref;
  };

  const handleOpenLinkedIn = () => {
    if (!contactLinkedin) {
      logMonetisationClientEvent("outreach_contact_missing_block", applicationId, "applications", {});
      return;
    }
    logMonetisationClientEvent("outreach_open_linkedin_click", applicationId, "applications", {});
    window.open(contactLinkedin, "_blank", "noopener,noreferrer");
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

        {recommendation ? (
          <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                {subject ? (
                  <p className="text-sm font-semibold text-[rgb(var(--ink))]">
                    {subject}
                  </p>
                ) : null}
                <p className="text-xs text-[rgb(var(--muted))]">
                  {recommendation.stage ? recommendation.stage.replace(/_/g, " ") : "Follow-up"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
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
                <form
                  action={createFollowupFromTemplateAction}
                  onSubmit={() =>
                    logMonetisationClientEvent(
                      "outreach_log_sent",
                      applicationId,
                      "applications",
                      { stage: recommendation.stage }
                    )
                  }
                >
                  <input type="hidden" name="application_id" value={applicationId} />
                  <input type="hidden" name="subject" value={subject} />
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
            <pre className="mt-3 whitespace-pre-wrap text-sm text-[rgb(var(--muted))]">
              {message}
            </pre>
          </div>
        ) : (
          <p className="text-sm text-[rgb(var(--muted))]">
            {OUTREACH_COPY.STATE_NONE}
          </p>
        )}

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
        </div>
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
