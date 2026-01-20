"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import ErrorBanner from "@/components/ErrorBanner";
import type { KeepMomentumModel } from "@/lib/keep-momentum";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";
import { buildActivationMeta } from "@/lib/activation-telemetry";

type Props = {
  model: KeepMomentumModel | null;
  error?: { requestId?: string | null; message?: string | null; code?: string | null } | null;
};

export default function KeepMomentumCard({ model, error }: Props) {
  const [dismissed, setDismissed] = useState(false);
  const viewLogged = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("keep-momentum-skip-until");
    if (stored) {
      const until = Number(stored);
      if (Number.isFinite(until) && Date.now() < until) {
        setDismissed(true);
      }
    }
  }, []);

  useEffect(() => {
    if (model && model.primary && !dismissed && !viewLogged.current) {
      viewLogged.current = true;
      logMonetisationClientEvent(
        "keep_momentum_view",
        model.primary.applicationId ?? null,
        "activation",
        buildActivationMeta({ appId: model.primary.applicationId ?? null, stepKey: model.meta.chosenRule })
      );
    }
  }, [model, dismissed]);

  useEffect(() => {
    if (error) {
      logMonetisationClientEvent(
        "keep_momentum_model_error",
        null,
        "activation",
        buildActivationMeta({ requestId: error.requestId ?? undefined })
      );
    }
  }, [error]);

  if (dismissed || error) {
    if (error) {
      return (
        <ErrorBanner
          title="Unable to load keep momentum"
          message={error.message ?? "Something went wrong."}
          requestId={error.requestId ?? undefined}
          onRetry={() => window.location.reload()}
        />
      );
    }
    return null;
  }

  if (!model || model.status === "not_ready" || model.status === "skipped" || !model.primary) {
    return null;
  }

  const onSkip = () => {
    if (typeof window !== "undefined") {
      const weekMs = 7 * 24 * 60 * 60 * 1000;
      window.localStorage.setItem("keep-momentum-skip-until", String(Date.now() + weekMs));
    }
    setDismissed(true);
    if (model.primary) {
      logMonetisationClientEvent(
        "keep_momentum_skip_week",
        model.primary.applicationId ?? null,
        "activation",
        buildActivationMeta({ appId: model.primary.applicationId ?? null, stepKey: model.meta.chosenRule, ctaKey: "skip_week" })
      );
    }
  };

  const logClick = (event: "keep_momentum_cta_click" | "keep_momentum_secondary_click", ctaKey: string) => {
    if (!model.primary) return;
    logMonetisationClientEvent(
      event,
      model.primary.applicationId ?? null,
      "activation",
      buildActivationMeta({ appId: model.primary.applicationId ?? null, stepKey: model.meta.chosenRule, ctaKey })
    );
  };

  return (
    <div className="rounded-2xl border border-black/10 bg-white/70 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">Keep momentum this week</p>
          <p className="text-sm font-semibold text-[rgb(var(--ink))]">{model.primary.title}</p>
          <p className="text-xs text-[rgb(var(--muted))]">{model.primary.reason} Small steps compound.</p>
          {model.secondary ? (
            <button
              type="button"
              onClick={() => {
                logClick("keep_momentum_secondary_click", model.secondary?.ruleId ?? "secondary");
                setDismissed(true);
              }}
              className="mt-2 text-[11px] font-semibold text-[rgb(var(--accent-strong))] underline-offset-4 hover:underline"
            >
              Not now
            </button>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onSkip}
          className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-[rgb(var(--ink))] hover:border-black/20"
        >
          Skip for a week
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Link
          href={model.primary.href}
          className="rounded-full bg-[rgb(var(--accent))] px-3 py-2 text-xs font-semibold text-white hover:bg-[rgb(var(--accent-strong))]"
          onClick={() => logClick("keep_momentum_cta_click", model.primary?.ruleId ?? "primary")}
        >
          {model.primary.ctaLabel}
        </Link>
      </div>
    </div>
  );
}
