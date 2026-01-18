"use client";

import { useEffect, useMemo, useState } from "react";
import { OFFER_COPY } from "@/lib/microcopy/offer";
import {
  type OfferSummary,
  type CounterProposal,
  buildNegotiationScripts,
  buildCounterSummary,
  countOfferCompletion,
} from "@/lib/offer-pack";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";

type Props = {
  applicationId: string;
  roleTitle: string;
  company?: string | null;
  hasOfferOutcome: boolean;
};

export default function OfferPackPanel({ applicationId, roleTitle, company, hasOfferOutcome }: Props) {
  const storageKey = useMemo(() => `cvf:offer-pack:${applicationId}`, [applicationId]);
  const flagKey = useMemo(() => `cvf:offer-flag:${applicationId}`, [applicationId]);
  const [summary, setSummary] = useState<OfferSummary>({ roleTitle, company: company ?? "" });
  const [counter, setCounter] = useState<CounterProposal>({ asks: [] });
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [variant, setVariant] = useState<"polite" | "direct" | "warm">("polite");
  const [isActive, setIsActive] = useState(hasOfferOutcome);
  const [viewLogged, setViewLogged] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(storageKey);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { summary: OfferSummary; counter: CounterProposal; savedAt?: string };
        setSummary({ roleTitle, company: company ?? "", ...(parsed.summary ?? {}) });
        setCounter(parsed.counter ?? { asks: [] });
        setSavedAt(parsed.savedAt ?? null);
      } catch {
        /* ignore */
      }
    }
    const flag = window.localStorage.getItem(flagKey);
    if (flag === "true") {
      setIsActive(true);
    }
  }, [company, flagKey, roleTitle, storageKey]);

  const scripts = useMemo(() => buildNegotiationScripts(summary, counter), [summary, counter]);
  const completion = useMemo(() => countOfferCompletion(summary), [summary]);
  const counterData = useMemo(() => buildCounterSummary(summary, counter), [summary, counter]);
  const selectedScript = scripts.find((s) => s.key === variant) ?? scripts[0];

  const handleSave = () => {
    const payload = {
      summary,
      counter,
      savedAt: new Date().toISOString(),
    };
    if (typeof window !== "undefined") {
      window.localStorage.setItem(storageKey, JSON.stringify(payload));
      setSavedAt(payload.savedAt);
    }
    logMonetisationClientEvent("offer_pack_save", applicationId, "applications");
  };

  const handleCopy = (text: string, meta: Record<string, any>) => {
    if (!text) return;
    navigator.clipboard.writeText(text).catch(() => undefined);
    logMonetisationClientEvent("offer_pack_copy_script", applicationId, "applications", meta);
  };

  const copyDecision = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text).catch(() => undefined);
    logMonetisationClientEvent("offer_pack_copy_decision", applicationId, "applications", { key });
  };

  const decisionTemplates = buildDecisionTemplates(summary);

  useEffect(() => {
    if (isActive && !viewLogged) {
      logMonetisationClientEvent("offer_pack_view", applicationId, "applications");
      setViewLogged(true);
    }
  }, [applicationId, isActive, viewLogged]);

  if (!isActive) {
    return (
      <div id="offer-pack" className="rounded-3xl border border-black/10 bg-white/70 p-5 shadow-sm">
        <p className="text-xs uppercase tracking-[0.18em] text-[rgb(var(--muted))]">{OFFER_COPY.TITLE}</p>
        <p className="text-sm text-[rgb(var(--muted))]">{OFFER_COPY.SUBTITLE_INACTIVE}</p>
        <button
          type="button"
          className="mt-3 rounded-full bg-[rgb(var(--ink))] px-4 py-2 text-xs font-semibold text-white"
          onClick={() => {
            setIsActive(true);
            if (typeof window !== "undefined") {
              window.localStorage.setItem(flagKey, "true");
            }
            logMonetisationClientEvent("offer_pack_missing_data_prompt", applicationId, "applications");
          }}
        >
          I’ve received an offer
        </button>
      </div>
    );
  }

  return (
    <div id="offer-pack" className="rounded-3xl border border-black/10 bg-gradient-to-br from-white via-white to-slate-50 p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[rgb(var(--muted))]">{OFFER_COPY.TITLE}</p>
          <p className="text-sm text-[rgb(var(--muted))]">{OFFER_COPY.SUBTITLE_ACTIVE}</p>
          <p className="text-xs text-[rgb(var(--muted))]">
            {OFFER_COPY.HELPERS.COMPLETION.replace(
              "{filled}",
              String(completion.filled)
            ).replace("{total}", String(completion.total))}
          </p>
        </div>
        {savedAt ? <span className="text-[10px] text-[rgb(var(--muted))]">Last saved {new Date(savedAt).toLocaleString()}</span> : null}
      </div>

      <div className="mt-4 space-y-3">
        <SectionCard title="Offer summary">
          <div className="grid gap-3 md:grid-cols-2">
            <TextField label="Role title" value={summary.roleTitle ?? ""} onChange={(v) => setSummary({ ...summary, roleTitle: v })} />
            <TextField label="Company" value={summary.company ?? ""} onChange={(v) => setSummary({ ...summary, company: v })} />
            <TextField
              label="Base salary"
              type="number"
              value={summary.baseSalary ?? ""}
              onChange={(v) => setSummary({ ...summary, baseSalary: v ? Number(v) : null })}
            />
            <TextField label="Currency" value={summary.currency ?? "GBP"} onChange={(v) => setSummary({ ...summary, currency: v })} />
            <TextField label="Bonus" value={summary.bonus ?? ""} onChange={(v) => setSummary({ ...summary, bonus: v })} />
            <TextField label="Equity" value={summary.equity ?? ""} onChange={(v) => setSummary({ ...summary, equity: v })} />
            <TextField label="Start date" value={summary.startDate ?? ""} onChange={(v) => setSummary({ ...summary, startDate: v })} />
            <TextField label="Location" value={summary.location ?? ""} onChange={(v) => setSummary({ ...summary, location: v })} />
            <TextField label="Hybrid policy" value={summary.hybridPolicy ?? ""} onChange={(v) => setSummary({ ...summary, hybridPolicy: v })} />
            <TextField label="Notice period" value={summary.noticePeriod ?? ""} onChange={(v) => setSummary({ ...summary, noticePeriod: v })} />
            <TextField label="Benefits" value={summary.benefitsNotes ?? ""} onChange={(v) => setSummary({ ...summary, benefitsNotes: v })} />
            <TextField label="Deadline to respond" value={summary.deadlineToRespond ?? ""} onChange={(v) => setSummary({ ...summary, deadlineToRespond: v })} />
            <TextField label="Recruiter name" value={summary.recruiterName ?? ""} onChange={(v) => setSummary({ ...summary, recruiterName: v })} />
            <TextField label="Recruiter email" value={summary.recruiterEmail ?? ""} onChange={(v) => setSummary({ ...summary, recruiterEmail: v })} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded-full bg-[rgb(var(--ink))] px-4 py-2 text-xs font-semibold text-white"
              onClick={handleSave}
            >
              {OFFER_COPY.BUTTONS.SAVE}
            </button>
            <p className="text-xs text-[rgb(var(--muted))]">{OFFER_COPY.HELPERS.TRUST}</p>
          </div>
        </SectionCard>

        <SectionCard title="Your counter">
          <div className="grid gap-3 md:grid-cols-3">
            <TextField
              label="Target base salary"
              type="number"
              value={counter.targetBase ?? ""}
              onChange={(v) => setCounter({ ...counter, targetBase: v ? Number(v) : null })}
            />
            <TextField
              label="Uplift %"
              type="number"
              value={counter.upliftPct ?? ""}
              onChange={(v) => setCounter({ ...counter, upliftPct: v ? Number(v) : null })}
            />
            <AskSelector
              asks={counter.asks ?? []}
              onChange={(next) => setCounter({ ...counter, asks: next })}
            />
          </div>
          <p className="mt-2 text-sm text-[rgb(var(--muted))]">
            {counterData.targetBase
              ? `Target: ${summary.currency ?? "GBP"} ${counterData.targetBase.toLocaleString()} (${counterData.upliftPct ?? "—"}% uplift)${
                  counterData.upliftAmount ? `, +${summary.currency ?? "GBP"} ${counterData.upliftAmount.toLocaleString()}` : ""
                }. ${counterData.askSummary}`
              : OFFER_COPY.HELPERS.MISSING_KEY}
          </p>
          <button
            type="button"
            className="mt-2 rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold text-[rgb(var(--ink))]"
            onClick={() => logMonetisationClientEvent("offer_pack_set_counter", applicationId, "applications")}
          >
            {OFFER_COPY.BUTTONS.COUNTER}
          </button>
        </SectionCard>

        <SectionCard title="Negotiation scripts">
          <div className="flex flex-wrap items-center gap-2">
            {scripts.map((script) => (
              <button
                key={script.key}
                type="button"
                onClick={() => {
                  setVariant(script.key);
                  logMonetisationClientEvent("offer_pack_view", applicationId, "applications", { variant: script.key });
                }}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  variant === script.key ? "bg-[rgb(var(--ink))] text-white" : "border border-black/10 bg-white text-[rgb(var(--ink))]"
                }`}
              >
                {script.key === "polite" ? "Polite" : script.key === "direct" ? "Direct" : "Warm"}
              </button>
            ))}
          </div>
          {selectedScript ? (
            <div className="mt-3 space-y-3 text-sm text-[rgb(var(--muted))]">
              <p className="text-xs text-[rgb(var(--muted))]">{selectedScript.reason}</p>
              <pre className="whitespace-pre-wrap rounded-2xl border border-black/10 bg-white/70 p-3">{selectedScript.email}</pre>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="rounded-full border border-black/10 bg-white px-3 py-1 text-[10px] font-semibold text-[rgb(var(--ink))]"
                  onClick={() => handleCopy(selectedScript.email, { variant: selectedScript.key, type: "email" })}
                >
                  {OFFER_COPY.BUTTONS.COPY}
                </button>
                <button
                  type="button"
                  className="rounded-full border border-black/10 bg-white px-3 py-1 text-[10px] font-semibold text-[rgb(var(--ink))]"
                  onClick={() => handleCopy(selectedScript.linkedin, { variant: selectedScript.key, type: "linkedin" })}
                >
                  Copy LinkedIn
                </button>
                <button
                  type="button"
                  className="rounded-full border border-black/10 bg-white px-3 py-1 text-[10px] font-semibold text-[rgb(var(--ink))]"
                  onClick={() => handleCopy(selectedScript.phone, { variant: selectedScript.key, type: "phone" })}
                >
                  Copy phone opener
                </button>
              </div>
              <p className="text-xs text-[rgb(var(--muted))]">Personalise bracketed items before sending.</p>
            </div>
          ) : null}
        </SectionCard>

        <SectionCard title="Decision templates">
          <div className="space-y-2">
            <DecisionRow
              label="Accept offer"
              onCopy={() => copyDecision(decisionTemplates.accept, "accept")}
            />
            <DecisionRow
              label="Decline offer"
              onCopy={() => copyDecision(decisionTemplates.decline, "decline")}
            />
            <DecisionRow
              label="Ask for time"
              onCopy={() => copyDecision(decisionTemplates.time, "time")}
            />
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-[rgb(var(--ink))]">{title}</p>
      </div>
      <div className="mt-3 space-y-2">{children}</div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string | number | null | undefined;
  type?: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="text-xs text-[rgb(var(--muted))]">
      {label}
      <input
        type={type}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-[rgb(var(--ink))]"
      />
    </label>
  );
}

function AskSelector({
  asks,
  onChange,
}: {
  asks: string[];
  onChange: (next: string[]) => void;
}) {
  const OPTIONS = [
    "Start date flexibility",
    "Hybrid days",
    "Sign-on bonus",
    "Annual bonus",
    "Training budget",
    "Extra holiday",
  ];
  return (
    <div className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm">
      <p className="text-xs text-[rgb(var(--muted))]">Optional asks</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {OPTIONS.map((opt) => {
          const active = asks.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => {
                const next = active ? asks.filter((a) => a !== opt) : [...asks, opt];
                onChange(next);
              }}
              className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                active ? "bg-[rgb(var(--ink))] text-white" : "border border-black/10 bg-white text-[rgb(var(--ink))]"
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DecisionRow({ label, onCopy }: { label: string; onCopy: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-black/10 bg-white px-3 py-2">
      <p className="text-sm text-[rgb(var(--ink))]">{label}</p>
      <button
        type="button"
        onClick={onCopy}
        className="rounded-full border border-black/10 bg-white px-3 py-1 text-[10px] font-semibold text-[rgb(var(--ink))]"
      >
        {OFFER_COPY.BUTTONS.COPY}
      </button>
    </div>
  );
}

function buildDecisionTemplates(summary: OfferSummary) {
  const currency = summary.currency || "GBP";
  const baseLine = summary.baseSalary
    ? `Thanks for the offer of ${currency} ${summary.baseSalary.toLocaleString()}.`
    : "Thanks for sharing the offer details.";
  const accept = [
    `Hi ${summary.recruiterName || "team"},`,
    "",
    baseLine,
    "I’m pleased to accept. Please share the next steps and paperwork.",
    "",
    "Thanks!",
    "",
  ].join("\n");
  const decline = [
    `Hi ${summary.recruiterName || "team"},`,
    "",
    "Thank you for the offer and your time. I’m going to decline this one.",
    "Appreciate the consideration and hope we can keep in touch.",
    "",
    "Best,",
    "",
  ].join("\n");
  const time = [
    `Hi ${summary.recruiterName || "team"},`,
    "",
    baseLine,
    summary.deadlineToRespond
      ? `Could I have 48 hours (before ${summary.deadlineToRespond}) to review details?`
      : "Could I have 48 hours to review the details?",
    "I’ll confirm as soon as I can.",
    "",
    "Thanks for understanding.",
    "",
  ].join("\n");
  return { accept, decline, time };
}
