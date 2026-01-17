"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  buildReturnToUrl,
  clearPendingAction,
  loadPendingAction,
  type PendingAction,
} from "@/lib/billing/pending-action";
import { parseCheckoutReturn } from "@/lib/billing/checkout-return";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";

type Props = {
  show?: boolean;
  applicationId?: string;
  surface?: "billing" | "applications" | "practice";
  subscriptionStatus?: string | null;
};

export default function PostPurchaseSuccessBanner({
  show = false,
  applicationId,
  surface = "billing",
  subscriptionStatus,
}: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [hidden, setHidden] = useState(false);
  const [resumeMode, setResumeMode] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [resuming, setResuming] = useState(false);
  const [isSubscription, setIsSubscription] = useState(false);
  const [successOnly, setSuccessOnly] = useState(false);
  const [status, setStatus] = useState<"success" | "cancel" | "failed" | null>(null);
  const [returnFrom, setReturnFrom] = useState<string | null>(null);
  const [planKey, setPlanKey] = useState<"monthly_30" | "monthly_80" | null>(null);
  const viewLogged = useMemo(() => ({ success: false, cancel: false, failed: false }), []);

  const pendingHref = useMemo(() => {
    if (!pending) return null;
    const url = new URL(buildReturnToUrl(pending), "http://localhost");
    return `${url.pathname}${url.search}${url.hash}`;
  }, [pending]);

  const markWatchdogStart = useCallback(
    (action: PendingAction, href: string, auto: boolean) => {
      if (typeof window === "undefined") return;
      const payload = {
        applicationId: action.applicationId,
        actionKey: action.type,
        href,
        startedAt: Date.now(),
        auto,
        subscription: isSubscription,
      };
      try {
        window.sessionStorage.setItem("cvf-watchdog-pending", JSON.stringify(payload));
      } catch {
        /* ignore */
      }
      window.dispatchEvent(new CustomEvent("cvf-watchdog-start", { detail: payload }));
    },
    [isSubscription]
  );

  const handleResume = useCallback(
    (auto = false) => {
      if (!pending || !pendingHref || resuming) return;
      setResuming(true);
      setCountdown(null);
      clearPendingAction();
      setPending(null);
      setHidden(true);
      markWatchdogStart(pending, pendingHref, auto);
      if (isSubscription) {
        if (auto) {
          logMonetisationClientEvent(
            "sub_post_purchase_auto_redirect",
            pending.applicationId,
            surface,
            { actionKey: pending.type }
          );
        } else {
          logMonetisationClientEvent(
            "sub_post_purchase_resume_click",
            pending.applicationId,
            surface,
            { actionKey: pending.type }
          );
        }
      }
      logMonetisationClientEvent(
        "billing_success_banner_resume_click",
        pending.applicationId,
        surface,
        { actionKey: pending.type, auto }
      );
      logMonetisationClientEvent("resume_clicked", pending.applicationId, surface, {
        actionKey: pending.type,
        auto,
      });
      const eventNameMap: Record<PendingAction["type"], string> = {
        autopack_generate: "cvf-resume-autopack",
        interview_pack_export: "cvf-resume-interview-pack",
        application_kit_download: "cvf-resume-kit",
        answer_pack_generate: "cvf-resume-answer-pack",
      };
      router.push(pendingHref);
      const eventName = eventNameMap[pending.type];
      if (eventName) {
        window.dispatchEvent(
          new CustomEvent(eventName, {
            detail: pending,
          })
        );
      }
    },
    [pending, pendingHref, resuming, router, surface, markWatchdogStart, isSubscription]
  );

  useEffect(() => {
    const params = parseCheckoutReturn(searchParams ?? undefined);
    const resumeRequested = params.resume;
    const success = show || params.status === "success" || params.resume;
    const cancel = params.status === "cancel";
    const failed = params.status === "failed";
    const subscriptionFlag =
      params.mode === "subscription" ||
      params.from === "streak_saver" ||
      params.from === "intent_tile" ||
      Boolean(params.planKey) ||
      Boolean(subscriptionStatus && subscriptionStatus !== "canceled");

    setIsSubscription(subscriptionFlag);
    setStatus(success ? "success" : cancel ? "cancel" : failed ? "failed" : null);
    setReturnFrom(params.from ?? null);
    setPlanKey(params.planKey);

    if (!success && !cancel && !failed) return;

    if (cancel || failed) {
      setHidden(false);
      setPending(null);
      setResumeMode(false);
      setCountdown(null);
      return;
    }

    const nextPending = loadPendingAction();
    if (
      nextPending &&
      (!applicationId || nextPending.applicationId === applicationId)
    ) {
      const sessionId =
        (searchParams?.get?.("session_id") as string | undefined) || "success";
      const guardKey = `pp_success_seen:${sessionId}:${nextPending.type}:${nextPending.applicationId}:${resumeRequested ? "resume" : "return"}`;
      if (
        typeof window !== "undefined" &&
        window.sessionStorage.getItem(guardKey) &&
        !pending
      ) {
        setHidden(true);
        return;
      }
      setPending(nextPending);
      setHidden(false);
      setResumeMode(resumeRequested);
      if (resumeRequested) {
        setCountdown((prev) => (prev === null ? 3 : prev));
        logMonetisationClientEvent(
          "resume_banner_shown",
          nextPending.applicationId,
          surface,
          { actionKey: nextPending.type }
        );
        if (subscriptionFlag) {
          logMonetisationClientEvent(
            "sub_post_purchase_auto_redirect",
            nextPending.applicationId,
            surface,
            { actionKey: nextPending.type, countdown: true }
          );
        }
      } else {
        setCountdown(null);
      }
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(guardKey, "1");
      }
      if (subscriptionFlag) {
        logMonetisationClientEvent(
          "sub_post_purchase_view",
          nextPending.applicationId,
          surface,
          { actionKey: nextPending.type, resume: resumeRequested, from: params.from }
        );
      }
      logMonetisationClientEvent(
        "billing_success_banner_view",
        nextPending.applicationId,
        surface,
        { actionKey: nextPending.type, resume: resumeRequested, from: params.from }
      );
      logMonetisationClientEvent(
        "checkout_return_view",
        nextPending.applicationId,
        surface,
        { status: "success", resume: resumeRequested, from: params.from, planKey: params.planKey }
      );
    } else {
      setSuccessOnly(true);
      setHidden(false);
      setResumeMode(false);
      setCountdown(null);
      if (subscriptionFlag && applicationId) {
        logMonetisationClientEvent("sub_post_purchase_view", applicationId, surface, {
          actionKey: "none",
          resume: false,
          from: params.from,
        });
        logMonetisationClientEvent(
          "checkout_return_view",
          applicationId,
          surface,
          { status: "success", resume: false, from: params.from, planKey: params.planKey }
        );
      }
    }
  }, [searchParams, show, applicationId, surface, pending, subscriptionStatus]);

  useEffect(() => {
    if (hidden || !status || !applicationId) return;
    if (status === "cancel" && !viewLogged.cancel) {
      viewLogged.cancel = true;
      logMonetisationClientEvent("checkout_cancel_view", applicationId, surface, {
        from: returnFrom,
        planKey,
      });
    }
    if (status === "failed" && !viewLogged.failed) {
      viewLogged.failed = true;
      logMonetisationClientEvent("checkout_failed_view", applicationId, surface, {
        from: returnFrom,
        planKey,
      });
    }
  }, [applicationId, hidden, planKey, returnFrom, status, surface, viewLogged]);

  useEffect(() => {
    if (!resumeMode || countdown === null || resuming) return;
    if (countdown <= 0) {
      handleResume(true);
      return;
    }
    const timer = window.setTimeout(
      () => setCountdown((prev) => (prev === null ? null : prev - 1)),
      1000
    );
    return () => window.clearTimeout(timer);
  }, [resumeMode, countdown, resuming, handleResume]);

  const handleDismiss = () => {
    setHidden(true);
    if (pending) {
      clearPendingAction();
    }
    if (pending && isSubscription) {
      logMonetisationClientEvent(
        "sub_post_purchase_not_now",
        pending.applicationId,
        surface,
        { actionKey: pending.type }
      );
    }
    if (pending) {
      logMonetisationClientEvent(
        "billing_success_banner_dismiss",
        pending.applicationId,
        surface,
        { actionKey: pending.type }
      );
      logMonetisationClientEvent(
        "resume_dismissed",
        pending.applicationId,
        surface,
        { actionKey: pending.type }
      );
      logMonetisationClientEvent(
        "checkout_return_dismiss",
        pending.applicationId,
        surface,
        { status: status ?? "success", from: returnFrom, planKey }
      );
    } else if (applicationId) {
      logMonetisationClientEvent(
        "checkout_return_dismiss",
        applicationId,
        surface,
        { status: status ?? "success", from: returnFrom, planKey }
      );
    }
  };

  const retryHref =
    (pendingHref && pendingHref.startsWith("/app/") ? pendingHref : null) ??
    "/app/billing";

  if (hidden || (!pending && !successOnly && !status)) return null;

  const actionLabels: Record<PendingAction["type"], string> = {
    autopack_generate: "Generate Autopack",
    interview_pack_export: "Export Interview Pack",
    application_kit_download: "Download Application Kit",
    answer_pack_generate: "Generate Answer Pack",
  };

  if (status === "cancel" || status === "failed") {
    const title =
      status === "cancel" ? "Checkout cancelled" : "Checkout didn’t complete";
    const body =
      status === "cancel"
        ? "No worries — you can pick up where you left off."
        : "Please try again. If it keeps happening, use a different browser.";
    const primary =
      status === "cancel" ? "Try again" : "Retry checkout";
    const secondary = status === "cancel" ? "Dismiss" : "Get help";
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-amber-800">{title}</p>
            <p className="text-xs text-amber-700">{body}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded-full bg-amber-700 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800"
              onClick={() => router.push(retryHref)}
            >
              {primary}
            </button>
            <button
              type="button"
              className="rounded-full border border-amber-200 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100"
              onClick={() => {
                if (status === "failed") {
                  logMonetisationClientEvent(
                    "checkout_help_click",
                    pending?.applicationId ?? applicationId,
                    surface,
                    { from: returnFrom, planKey }
                  );
                  window.open("/app/billing", "_blank");
                }
                handleDismiss();
              }}
            >
              {secondary}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (successOnly && !hidden) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-emerald-800">
              Payment confirmed
            </p>
            <p className="text-xs text-emerald-700">
              Resuming your next step now.
            </p>
          </div>
          <button
            type="button"
            className="rounded-full border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
            onClick={handleDismiss}
          >
            Not now
          </button>
        </div>
      </div>
    );
  }

  if (!pending || !pendingHref || hidden) return null;

  const subtitle =
    resumeMode && countdown !== null
      ? `Redirecting in ${countdown}s…`
      : "Resuming your next step now.";
  const title = "Payment confirmed";

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-emerald-800">
            {title}
          </p>
          <p className="text-xs text-emerald-700">{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded-full border border-emerald-200 bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
            onClick={() => handleResume()}
          >
            {resumeMode && countdown !== null
              ? `Redirecting in ${countdown}s`
              : `Resume now`}
          </button>
          <button
            type="button"
            className="rounded-full border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
            onClick={handleDismiss}
          >
            Not now
          </button>
        </div>
      </div>
      <p className="mt-2 text-xs text-emerald-700">
        {actionLabels[pending.type]} · We’ll take you back to the exact spot.
      </p>
    </div>
  );
}
