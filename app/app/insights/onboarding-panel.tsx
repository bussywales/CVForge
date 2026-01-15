"use client";

import Link from "next/link";
import Button from "@/components/Button";
import type { OnboardingStep } from "@/lib/onboarding";

type Props = {
  steps: OnboardingStep[];
  completed: number;
  total: number;
  onCreateSample?: () => Promise<void>;
  hasApplications: boolean;
};

const statusTone: Record<string, string> = {
  done: "bg-emerald-50 text-emerald-700",
  in_progress: "bg-amber-50 text-amber-700",
  not_started: "bg-slate-100 text-slate-600",
};

export default function OnboardingPanel({
  steps,
  completed,
  total,
  onCreateSample,
  hasApplications,
}: Props) {
  return (
    <div className="rounded-3xl border border-black/10 bg-white/80 p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
            First Job Win (10 minutes)
          </p>
          <p className="text-sm text-[rgb(var(--muted))]">
            {completed} of {total} steps done
          </p>
        </div>
        {!hasApplications && onCreateSample ? (
          <Button type="button" variant="secondary" onClick={onCreateSample}>
            Create a sample application
          </Button>
        ) : null}
      </div>

      <div className="mt-4 space-y-3">
        {steps.map((step, index) => (
          <div
            key={step.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white/70 p-4"
          >
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
                Step {index + 1}
              </p>
              <p className="text-sm font-semibold text-[rgb(var(--ink))]">
                {step.title}
              </p>
              <p className="text-xs text-[rgb(var(--muted))]">{step.hint}</p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] ${statusTone[step.status]}`}
              >
                {step.status.replace("_", " ")}
              </span>
              <Link
                href={step.href}
                className="rounded-full border border-black/10 bg-[rgb(var(--ink))] px-4 py-2 text-sm font-semibold text-white hover:bg-black"
              >
                Go
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
