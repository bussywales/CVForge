"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ActivationModel } from "@/lib/activation-loop";
import { activationCoreProgress } from "@/lib/activation-loop";
import { ACTIVATION_COPY } from "@/lib/microcopy/activation";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";
import ErrorBanner from "@/components/ErrorBanner";
import { buildActivationMeta } from "@/lib/activation-telemetry";

type Props = {
  model: ActivationModel | null;
  error?: { requestId?: string | null; message?: string | null; code?: string | null } | null;
};

export default function ActivationCard({ model, error }: Props) {
  const [dismissed, setDismissed] = useState(false);
  const primaryApplicationId = model?.primaryApplicationId ?? null;
  const viewLogged = useRef(false);
  const completionLogged = useRef(false);
  const progress = model ? activationCoreProgress(model.steps) : { doneCount: 0, totalCount: 4 };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("activation-skip-until");
    if (stored) {
      const until = Number(stored);
      if (Number.isFinite(until) && Date.now() < until) {
        setDismissed(true);
      }
    }
  }, []);

  useEffect(() => {
    if (model && !viewLogged.current) {
      viewLogged.current = true;
      logMonetisationClientEvent("activation_view", primaryApplicationId, "activation", buildActivationMeta({ appId: primaryApplicationId }));
    }
  }, [model, primaryApplicationId]);

  useEffect(() => {
    if (error) {
      logMonetisationClientEvent(
        "activation_model_error",
        primaryApplicationId,
        "activation",
        buildActivationMeta({ appId: primaryApplicationId, requestId: error.requestId ?? undefined, stepKey: error.code ?? "unknown" })
      );
    }
  }, [error, primaryApplicationId]);

  const coreComplete = useMemo(() => {
    if (!model) return false;
    const coreIds = ["add_application", "first_outreach", "schedule_followup", "log_outcome"];
    return coreIds.every((id) => model.steps.find((s) => s.id === id)?.isDone);
  }, [model]);

  useEffect(() => {
    if (coreComplete && !completionLogged.current) {
      completionLogged.current = true;
      logMonetisationClientEvent(
        "activation_completed",
        primaryApplicationId,
        "activation",
        buildActivationMeta({ appId: primaryApplicationId })
      );
    }
  }, [coreComplete, primaryApplicationId]);

  if (dismissed) return null;

  if (error) {
    return (
      <ErrorBanner
        title="Unable to load activation steps"
        message={error.message ?? "Something went wrong. Please try again."}
        requestId={error.requestId ?? undefined}
        onRetry={() => window.location.reload()}
      />
    );
  }

  if (!model) return null;

  const nextStep = model.steps.find((s) => s.id === model.nextBest.id) ?? model.steps.find((s) => !s.isDone);
  const handleSkip = () => {
    if (typeof window !== "undefined") {
      const weekMs = 7 * 24 * 60 * 60 * 1000;
      window.localStorage.setItem("activation-skip-until", String(Date.now() + weekMs));
    }
    setDismissed(true);
    logMonetisationClientEvent(
      "activation_skip_week",
      primaryApplicationId,
      "activation",
      buildActivationMeta({ appId: primaryApplicationId, ctaKey: "skip_week" })
    );
  };
  const logCtaClick = (stepId: string, ctaId: string) => {
    logMonetisationClientEvent(
      "activation_cta_click",
      primaryApplicationId,
      "activation",
      buildActivationMeta({ appId: primaryApplicationId, stepKey: stepId, ctaKey: ctaId })
    );
  };

  return (
    <div className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">{ACTIVATION_COPY.title}</p>
          <p className="text-sm font-semibold text-[rgb(var(--ink))]">{ACTIVATION_COPY.subtitle}</p>
        </div>
        <div className="flex items-center gap-3 text-xs text-[rgb(var(--muted))]">
          <button
            type="button"
            onClick={handleSkip}
            className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-[rgb(var(--ink))] hover:border-black/20"
          >
            Skip for now
          </button>
          <div className="h-2 w-32 overflow-hidden rounded-full border border-black/10 bg-white">
            <div
              className="h-2 bg-[rgb(var(--accent))]"
              style={{ width: `${Math.max(10, model.progress.percent)}%` }}
            />
          </div>
          <p className="mt-1 text-[11px]">
            {progress.doneCount}/{progress.totalCount} complete
          </p>
        </div>
      </div>
      <div className="mt-3 space-y-2">
        {model.steps.map((step) => (
          <div
            key={step.id}
            className="flex items-start justify-between gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-xs"
          >
            <div>
              <p className="font-semibold text-[rgb(var(--ink))]">{step.title}</p>
              {step.description ? <p className="text-[11px] text-[rgb(var(--muted))]">{step.description}</p> : null}
              {step.reasonIfLocked ? <p className="text-[10px] text-amber-700">{step.reasonIfLocked}</p> : null}
            </div>
            <div className="flex flex-col items-end gap-1">
              <span
                className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                  step.isDone ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-[rgb(var(--ink))]"
                }`}
              >
                {step.isDone ? "Done" : "Pending"}
              </span>
              {!step.isDone ? (
                <Link
                  href={step.href}
              className="text-[11px] font-semibold text-[rgb(var(--accent))] underline-offset-2 hover:underline"
              onClick={() =>
                {
                    logMonetisationClientEvent(
                      "activation_step_click",
                      primaryApplicationId,
                      "activation",
                      buildActivationMeta({ appId: primaryApplicationId, stepKey: step.id, ctaKey: "step_link" })
                    );
                    logCtaClick(step.id, "step_link");
                  }
                }
              >
                {step.ctaLabel}
              </Link>
              ) : null}
            </div>
          </div>
        ))}
      </div>
      {nextStep ? (
        <div className="mt-3 flex items-center justify-between rounded-xl bg-[rgb(var(--accent))]/10 px-3 py-2 text-xs">
          <div>
            <p className="font-semibold text-[rgb(var(--ink))]">Next best</p>
            <p className="text-[11px] text-[rgb(var(--muted))]">{ACTIVATION_COPY.nextBestWhy}</p>
          </div>
          <Link
            href={nextStep.href}
            className="rounded-full bg-[rgb(var(--accent))] px-3 py-1 text-[11px] font-semibold text-white hover:bg-[rgb(var(--accent-strong))]"
            onClick={() =>
              {
                logMonetisationClientEvent(
                  "activation_primary_cta_click",
                  primaryApplicationId,
                  "activation",
                  buildActivationMeta({ appId: primaryApplicationId, stepKey: nextStep.id, ctaKey: "primary" })
                );
                logCtaClick(nextStep.id, "primary");
              }
            }
          >
            Do next
          </Link>
        </div>
      ) : null}
      {model.celebration ? (
        <p className="mt-2 text-[11px] text-emerald-700">{model.celebration}</p>
      ) : null}
    </div>
  );
}
