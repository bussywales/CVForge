"use client";

import Link from "next/link";
import { useEffect } from "react";
import type { ActivationModel } from "@/lib/activation-loop";
import { ACTIVATION_COPY } from "@/lib/microcopy/activation";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";
import ErrorBanner from "@/components/ErrorBanner";

type Props = {
  model: ActivationModel | null;
  error?: { requestId?: string | null; message?: string | null; code?: string | null } | null;
};

export default function ActivationCard({ model, error }: Props) {
  useEffect(() => {
    if (model) {
      logMonetisationClientEvent("activation_view", null, "activation");
    }
  }, [model]);

  useEffect(() => {
    if (error) {
      logMonetisationClientEvent("activation_model_error", null, "activation", {
        code: error.code ?? "unknown",
      });
    }
  }, [error]);

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

  return (
    <div className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">{ACTIVATION_COPY.title}</p>
          <p className="text-sm font-semibold text-[rgb(var(--ink))]">{ACTIVATION_COPY.subtitle}</p>
        </div>
        <div className="text-right text-xs text-[rgb(var(--muted))]">
          <div className="h-2 w-32 overflow-hidden rounded-full border border-black/10 bg-white">
            <div
              className="h-2 bg-[rgb(var(--accent))]"
              style={{ width: `${Math.max(10, model.progress.percent)}%` }}
            />
          </div>
          <p className="mt-1 text-[11px]">
            {model.progress.doneCount}/{model.progress.totalCount} complete
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
                    logMonetisationClientEvent("activation_step_click", null, "activation", {
                      stepId: step.id,
                      hrefType: "link",
                    })
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
              logMonetisationClientEvent("activation_primary_cta_click", null, "activation", {
                stepId: nextStep.id,
                hrefType: "link",
              })
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
