"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  buildReturnToUrl,
  clearPendingAction,
  loadPendingAction,
  type PendingAction,
} from "@/lib/billing/pending-action";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";

type Props = {
  show?: boolean;
  applicationId?: string;
  surface?: "billing" | "applications" | "practice";
};

export default function PostPurchaseSuccessBanner({
  show = false,
  applicationId,
  surface = "billing",
}: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [hidden, setHidden] = useState(false);

  const pendingHref = useMemo(() => {
    if (!pending) return null;
    const url = new URL(buildReturnToUrl(pending), "http://localhost");
    return `${url.pathname}${url.search}${url.hash}`;
  }, [pending]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams ?? undefined);
    const success =
      show ||
      params.has("success") ||
      params.has("purchased") ||
      params.get("checkout") === "success";

    if (!success) return;

    const nextPending = loadPendingAction();
    if (
      nextPending &&
      (!applicationId || nextPending.applicationId === applicationId)
    ) {
      const sessionId = params.get("session_id") || "success";
      const guardKey = `pp_success_seen:${sessionId}:${nextPending.type}:${nextPending.applicationId}`;
      if (typeof window !== "undefined" && window.sessionStorage.getItem(guardKey)) {
        setHidden(true);
        return;
      }
      setPending(nextPending);
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(guardKey, "1");
      }
      logMonetisationClientEvent(
        "billing_success_banner_view",
        nextPending.applicationId,
        surface,
        { actionKey: nextPending.type }
      );
    }
  }, [searchParams, show, applicationId, surface]);

  if (!pending || !pendingHref || hidden) return null;

  const actionLabels: Record<PendingAction["type"], string> = {
    autopack_generate: "Generate Autopack",
    interview_pack_export: "Export Interview Pack",
    application_kit_download: "Download Application Kit",
    answer_pack_generate: "Generate Answer Pack",
  };

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-emerald-800">
            Payment successful — finish what you started.
          </p>
          <p className="text-xs text-emerald-700">
            You’ll be taken back to the exact step.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded-full border border-emerald-200 bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
            onClick={() => {
              logMonetisationClientEvent(
                "billing_success_banner_resume_click",
                pending.applicationId,
                surface,
                { actionKey: pending.type }
              );
              router.push(pendingHref);
            }}
          >
            Resume: {actionLabels[pending.type]}
          </button>
          <button
            type="button"
            className="rounded-full border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
            onClick={() => {
              setHidden(true);
              clearPendingAction();
              logMonetisationClientEvent(
                "billing_success_banner_dismiss",
                pending.applicationId,
                surface,
                { actionKey: pending.type }
              );
            }}
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
