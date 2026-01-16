"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Button from "@/components/Button";
import { usePathname, useSearchParams } from "next/navigation";
import CreditGateModal from "@/app/app/billing/credit-gate-modal";
import { needsHardGate, shouldSoftGate } from "@/lib/billing/gating";
import { getActionRoiLine } from "@/lib/billing/action-roi";
import {
  addResumeParam,
  clearPendingAction,
  savePendingAction,
} from "@/lib/billing/pending-action";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";

type AutopackGenerateButtonProps = {
  applicationId: string;
  balance: number;
  returnTo?: string;
};

type GenerateState = {
  status: "idle" | "loading" | "error";
  message?: string;
  billingUrl?: string;
};

export default function AutopackGenerateButton({
  applicationId,
  balance,
  returnTo,
}: AutopackGenerateButtonProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [state, setState] = useState<GenerateState>({ status: "idle" });
  const [showGate, setShowGate] = useState(false);

  const currentReturn =
    returnTo ??
    `${pathname}${
      searchParams?.toString() ? `?${searchParams.toString()}` : ""
    }`;
  const resumeReturnTo = addResumeParam(currentReturn);

  const handleGenerate = useCallback(async () => {
    setState({ status: "loading" });

    try {
      clearPendingAction();
    } catch {
      /* ignore */
    }

    try {
      const response = await fetch("/api/autopack/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ applicationId }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setState({
          status: "error",
          message:
            payload?.error ?? "Unable to generate an autopack right now.",
          billingUrl: payload?.billingUrl,
        });
        return;
      }

      const autopackId = payload?.autopackId as string | undefined;
      const creditsRemaining = payload?.creditsRemaining as number | undefined;
      const creditUsed = payload?.creditUsed as boolean | undefined;

      if (autopackId) {
        const params = new URLSearchParams({ generated: "1" });

        if (typeof creditsRemaining === "number" && Number.isFinite(creditsRemaining)) {
          params.set("remaining", String(creditsRemaining));
        }

        if (creditUsed === false) {
          params.set("used", "0");
        }

        logMonetisationClientEvent(
          "autopack_generated",
          applicationId,
          "applications"
        );
        logMonetisationClientEvent(
          "resume_completed",
          applicationId,
          "applications",
          { actionKey: "autopack_generate" }
        );
        window.dispatchEvent(
          new CustomEvent("cvf-resume-completed", {
            detail: { applicationId, actionKey: "autopack_generate" },
          })
        );

        router.push(
          `/app/applications/${applicationId}/autopacks/${autopackId}?${params.toString()}`
        );
      }

      router.refresh();
      setState({ status: "idle" });
    } catch (error) {
      setState({
        status: "error",
        message: "Unable to generate an autopack right now.",
      });
    }
  }, [applicationId, router]);

  useEffect(() => {
    const callback = (event: Event) => {
      const custom = event as CustomEvent;
      if (custom.detail?.applicationId === applicationId) {
        handleGenerate();
      }
    };
    window.addEventListener("cvf-resume-autopack", callback);
    return () => window.removeEventListener("cvf-resume-autopack", callback);
  }, [applicationId, handleGenerate]);

  return (
    <div className="space-y-2">
      <Button
        type="button"
        onClick={() => {
          if (needsHardGate(balance, 1)) {
            savePendingAction({
              type: "autopack_generate",
              applicationId,
              returnTo: resumeReturnTo,
              createdAt: Date.now(),
            });
            logMonetisationClientEvent(
              "gate_blocked",
              applicationId,
              "applications"
            );
            logMonetisationClientEvent(
              "billing_clicked",
              applicationId,
              "applications"
            );
            router.push(
              `/app/billing?returnTo=${encodeURIComponent(resumeReturnTo)}`
            );
            return;
          }
          if (shouldSoftGate(balance, 1)) {
            savePendingAction({
              type: "autopack_generate",
              applicationId,
              returnTo: resumeReturnTo,
              createdAt: Date.now(),
            });
            logMonetisationClientEvent(
              "gate_shown",
              applicationId,
              "applications"
            );
            setShowGate(true);
            return;
          }
          handleGenerate();
        }}
        disabled={state.status === "loading"}
      >
        {state.status === "loading" ? "Generating..." : "Generate Autopack"}
      </Button>
      {state.status === "error" && state.message ? (
        <div className="space-y-1 text-xs text-red-600">
          <p>{state.message}</p>
          {state.billingUrl ? (
            <Link
              href={state.billingUrl}
              className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 underline-offset-2 hover:underline"
            >
              Go to billing
            </Link>
          ) : null}
        </div>
      ) : null}
      <CreditGateModal
        open={showGate}
        onClose={() => setShowGate(false)}
        cost={1}
        balance={balance}
        actionLabel="Generate Autopack"
        roiLine={getActionRoiLine("autopack.generate")}
        referralHref="/app/billing#refer"
        onContinue={() => {
          setShowGate(false);
          handleGenerate();
        }}
        onGoBilling={() =>
          {
            logMonetisationClientEvent(
              "billing_clicked",
              applicationId,
              "applications"
            );
            router.push(
              `/app/billing?returnTo=${encodeURIComponent(resumeReturnTo)}`
            );
          }
        }
      />
    </div>
  );
}
