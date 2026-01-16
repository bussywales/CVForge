"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { NextBestAction } from "@/lib/next-best-actions";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";

type Props = {
  applicationId: string;
  actions: NextBestAction[];
};

export default function ResumeCompletionNudge({ applicationId, actions }: Props) {
  const [visible, setVisible] = useState(false);
  const [nextAction, setNextAction] = useState<NextBestAction | null>(null);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as {
        applicationId?: string;
        actionKey?: string;
      };
      if (detail?.applicationId !== applicationId) return;
      const candidate = actions[0];
      if (!candidate) return;
      setNextAction(candidate);
      setVisible(true);
    };
    window.addEventListener("cvf-resume-completed", handler);
    return () => window.removeEventListener("cvf-resume-completed", handler);
  }, [actions, applicationId]);

  useEffect(() => {
    if (!visible) return;
    const timer = window.setTimeout(() => setVisible(false), 8000);
    return () => window.clearTimeout(timer);
  }, [visible]);

  if (!visible || !nextAction) return null;

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-emerald-800">
            Done — next best step:
          </p>
          <p className="text-xs text-emerald-700">{nextAction.label}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={nextAction.href}
            className="rounded-full border border-emerald-200 bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
            onClick={() => {
              logMonetisationClientEvent(
                "resume_next_step_click",
                applicationId,
                "applications",
                { target: nextAction.id }
              );
            }}
          >
            Go
          </Link>
          <button
            type="button"
            className="rounded-full border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
            onClick={() => setVisible(false)}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
