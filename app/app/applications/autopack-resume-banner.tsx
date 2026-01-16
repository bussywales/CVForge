"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  buildReturnToUrl,
  clearPendingAction,
  loadPendingAction,
  type PendingAction,
} from "@/lib/billing/pending-action";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";

type Props = {
  applicationId: string;
};

export default function AutopackResumeBanner({ applicationId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resumeRequested = searchParams?.get("resume") === "1";
  const [pending, setPending] = useState<PendingAction | null>(null);

  useEffect(() => {
    if (resumeRequested) return;
    const params = new URLSearchParams(searchParams ?? undefined);
    const purchased = params.has("purchased") || params.get("checkout") === "success";
    const pending = loadPendingAction();
    if (
      pending &&
      pending.applicationId === applicationId &&
      purchased
    ) {
      setPending(pending);
      logMonetisationClientEvent("resume_banner_shown", applicationId, "applications", {
        actionKey: pending.type,
      });
    }
  }, [applicationId, resumeRequested, searchParams]);

  const resumeHref = useMemo(() => {
    if (!pending) return null;
    const url = new URL(buildReturnToUrl(pending), "http://localhost");
    return url.pathname + url.search + url.hash;
  }, [pending]);

  if (!pending || !resumeHref || resumeRequested) return null;

  const messages: Record<PendingAction["type"], { title: string; body: string }> = {
    autopack_generate: {
      title: "Ready to generate your Autopack.",
      body: "We saved where you left off. Resume when you’re ready.",
    },
    interview_pack_export: {
      title: "Ready to export your Interview Pack.",
      body: "Resume the export now.",
    },
    application_kit_download: {
      title: "Ready to download your Application Kit.",
      body: "Resume the kit download now.",
    },
    answer_pack_generate: {
      title: "Ready to generate your Answer Pack.",
      body: "Resume the answer generation now.",
    },
  };

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-emerald-800">
            {messages[pending.type].title}
          </p>
          <p className="text-xs text-emerald-700">{messages[pending.type].body}</p>
        </div>
        <button
          type="button"
          className="rounded-full border border-emerald-200 bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
          onClick={() => {
            clearPendingAction();
            setPending(null);
            logMonetisationClientEvent("resume_clicked", applicationId, "applications", {
              actionKey: pending.type,
            });
            router.push(resumeHref);
            const eventNameMap: Record<PendingAction["type"], string> = {
              autopack_generate: "cvf-resume-autopack",
              interview_pack_export: "cvf-resume-interview-pack",
              application_kit_download: "cvf-resume-kit",
              answer_pack_generate: "cvf-resume-answer-pack",
            };
            window.dispatchEvent(
              new CustomEvent(eventNameMap[pending.type], {
                detail: pending,
              })
            );
          }}
        >
          Resume
        </button>
        <button
          type="button"
          className="rounded-full border border-emerald-200 px-4 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
          onClick={() => {
            clearPendingAction();
            setPending(null);
            logMonetisationClientEvent("resume_dismissed", applicationId, "applications", {
              actionKey: pending.type,
            });
          }}
        >
          Not now
        </button>
      </div>
    </div>
  );
}
