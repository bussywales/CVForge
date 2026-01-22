"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";
import type { OnboardingModel, OnboardingStepKey } from "@/lib/onboarding/onboarding";

type Props = {
  model: OnboardingModel | null;
  requestId?: string | null;
  primaryHref?: string;
};

const CTA_MAP: Record<OnboardingStepKey, { label: string; href: string }> = {
  create_cv: { label: "Create your first CV", href: "/app/applications/new" },
  export_cv: { label: "Export CV", href: "/app/applications" },
  create_application: { label: "Create your first application", href: "/app/applications/new" },
  schedule_interview_optional: { label: "Schedule an interview", href: "/app/pipeline" },
};

export default function OnboardingCard({ model, requestId, primaryHref }: Props) {
  const [dismissed, setDismissed] = useState(false);
  const [skipUntil, setSkipUntil] = useState<string | null>(model?.skipUntil ?? null);
  const [skipMessage, setSkipMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isSkipped = useMemo(() => {
    if (!skipUntil) return false;
    return new Date(skipUntil).getTime() > Date.now();
  }, [skipUntil]);

  useEffect(() => {
    if (model && !dismissed && !isSkipped) {
      logMonetisationClientEvent("onboarding_card_view", requestId ?? null, "user");
    }
  }, [model, dismissed, isSkipped, requestId]);

  if (!model || dismissed || isSkipped) {
    return null;
  }

  const nextSteps = model.steps.filter((s) => s.status === "todo").slice(0, 2);
  const nextStep = nextSteps[0];
  const cta = nextStep ? CTA_MAP[nextStep.key] : null;
  const fallbackHref = primaryHref ?? "/app/applications/new";
  const primaryLink = cta?.href ?? fallbackHref;
  const primaryLabel = cta?.label ?? "Start now";

  const handleSkip = async () => {
    setLoading(true);
    setSkipMessage(null);
    try {
      const res = await fetch("/api/onboarding/skip", { method: "POST", headers: { "Content-Type": "application/json" } });
      const data = await res.json().catch(() => null);
      if (!data?.ok) {
        setSkipMessage("Unable to skip — try again");
        return;
      }
      setSkipUntil(data.skipUntil ?? null);
      logMonetisationClientEvent("onboarding_skip_week", requestId ?? null, "user");
    } catch {
      setSkipMessage("Unable to skip — try again");
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    logMonetisationClientEvent("onboarding_dismiss_local", requestId ?? null, "user");
  };

  const handleCtaClick = (step: OnboardingStepKey | null, destination: string) => {
    logMonetisationClientEvent("onboarding_step_cta_click", requestId ?? null, "user", { meta: { step: step ?? "unknown", destination } });
  };

  return (
    <div className="rounded-3xl border border-black/10 bg-white/90 p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">Getting started</p>
          <h2 className="text-lg font-semibold text-[rgb(var(--ink))]">Reach first success fast</h2>
          <p className="text-xs text-[rgb(var(--muted))]">
            {model.doneCount} of {model.totalCount} complete.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-[rgb(var(--ink))] hover:border-black/20"
            onClick={handleSkip}
            disabled={loading}
          >
            Skip for a week
          </button>
          <button
            type="button"
            className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-[rgb(var(--muted))] hover:border-black/20"
            onClick={handleDismiss}
            disabled={loading}
          >
            Dismiss
          </button>
        </div>
      </div>
      <div className="mt-3 space-y-2">
        {nextSteps.length === 0 ? (
          <p className="text-sm text-[rgb(var(--ink))]">All core steps done. Keep momentum with your next applications.</p>
        ) : (
          nextSteps.map((step) => (
            <div key={step.key} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white px-3 py-2">
              <div>
                <p className="text-sm font-semibold text-[rgb(var(--ink))]">{CTA_MAP[step.key]?.label ?? step.key}</p>
                <p className="text-xs text-[rgb(var(--muted))]">
                  {step.key === "create_cv"
                    ? "Generate your first CV to unlock exports."
                    : step.key === "export_cv"
                      ? "Download a CV export to share safely."
                      : step.key === "create_application"
                        ? "Add your first application to start the funnel."
                        : "Optional: prep for interviews early."}
                </p>
              </div>
              <Link
                href={CTA_MAP[step.key]?.href ?? fallbackHref}
                className="rounded-full bg-[rgb(var(--ink))] px-3 py-1 text-xs font-semibold text-white hover:bg-black"
                onClick={() => handleCtaClick(step.key, CTA_MAP[step.key]?.href ?? fallbackHref)}
              >
                {CTA_MAP[step.key]?.label ?? "Open"}
              </Link>
            </div>
          ))
        )}
      </div>
      {nextSteps.length === 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Link
            href={fallbackHref}
            className="rounded-full bg-[rgb(var(--accent))] px-4 py-2 text-sm font-semibold text-white hover:bg-[rgb(var(--accent-strong))]"
            onClick={() => handleCtaClick(null, fallbackHref)}
          >
            Continue
          </Link>
        </div>
      ) : null}
      {skipMessage ? <p className="mt-2 text-xs text-amber-700">{skipMessage}</p> : null}
    </div>
  );
}
