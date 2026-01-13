"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Button from "@/components/Button";
import type { KitChecklistItem, KitNextAction } from "@/lib/application-kit";

type ExportState = {
  status: "idle" | "loading" | "error";
  message?: string;
};

type ApplicationKitPanelProps = {
  applicationId: string;
  checklist: KitChecklistItem[];
  score: number;
  nextActions: KitNextAction[];
  downloadEnabled: boolean;
  downloadHint?: string;
  contents: string[];
};

function getFilenameFromDisposition(
  disposition: string | null,
  fallback: string
) {
  if (!disposition) {
    return fallback;
  }

  const match = disposition.match(/filename="(.+?)"/);
  return match?.[1] ?? fallback;
}

export default function ApplicationKitPanel({
  applicationId,
  checklist,
  score,
  nextActions,
  downloadEnabled,
  downloadHint,
  contents,
}: ApplicationKitPanelProps) {
  const [state, setState] = useState<ExportState>({ status: "idle" });
  const [showContents, setShowContents] = useState(false);

  const scoreTone = useMemo(() => {
    if (score >= 80) {
      return "bg-emerald-100 text-emerald-700";
    }
    if (score >= 60) {
      return "bg-amber-100 text-amber-700";
    }
    return "bg-red-100 text-red-700";
  }, [score]);

  const downloadKit = async () => {
    setState({ status: "loading" });
    try {
      const response = await fetch(
        `/api/application/${applicationId}/kit.zip`,
        { credentials: "include" }
      );

      if (!response.ok) {
        const contentType = response.headers.get("content-type") ?? "";
        if (contentType.includes("application/json")) {
          const payload = await response.json().catch(() => ({}));
          setState({
            status: "error",
            message: payload?.error ?? "Export failed. Please try again.",
          });
        } else {
          setState({
            status: "error",
            message: "Export failed. Please try again.",
          });
        }
        return;
      }

      const blob = await response.blob();
      const filename = getFilenameFromDisposition(
        response.headers.get("content-disposition"),
        "cvforge-application-kit.zip"
      );
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setState({ status: "idle" });
    } catch (error) {
      console.error("[application-kit.export]", error);
      setState({
        status: "error",
        message: "Export failed. Please try again.",
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
              Application Kit
            </p>
            <p className="mt-2 text-sm text-[rgb(var(--muted))]">
              Check readiness and download the best-ready artefacts.
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${scoreTone}`}
          >
            Kit readiness {score}/100
          </span>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {checklist.map((item) => (
          <div
            key={item.id}
            className="rounded-2xl border border-black/10 bg-white/80 p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-[rgb(var(--ink))]">
                {item.label}
              </span>
              <span
                className={`rounded-full px-3 py-1 text-[10px] font-semibold ${
                  item.ok
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                {item.ok ? "Ready" : "Needs work"}
              </span>
            </div>
            <p className="mt-2 text-xs text-[rgb(var(--muted))]">
              {item.hint}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
            Next Best Actions
          </p>
          {nextActions.length === 0 ? (
            <span className="text-xs text-emerald-700">All set.</span>
          ) : null}
        </div>
        <div className="mt-3 space-y-3">
          {nextActions.map((action) => (
            <div
              key={action.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-black/10 bg-white/70 p-3"
            >
              <span className="text-sm text-[rgb(var(--ink))]">
                {action.label}
              </span>
              <Link
                href={action.href}
                className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-[rgb(var(--ink))]"
              >
                Go
              </Link>
            </div>
          ))}
          {nextActions.length === 0 ? (
            <p className="text-xs text-[rgb(var(--muted))]">
              Keep practising and export when ready.
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          onClick={downloadKit}
          disabled={!downloadEnabled || state.status === "loading"}
        >
          {state.status === "loading"
            ? "Preparing kit..."
            : "Download Application Kit (ZIP)"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setShowContents((prev) => !prev)}
        >
          {showContents ? "Hide kit contents" : "View kit contents"}
        </Button>
        {!downloadEnabled && downloadHint ? (
          <span className="text-xs text-[rgb(var(--muted))]">
            {downloadHint}
          </span>
        ) : null}
      </div>

      {showContents ? (
        <div className="rounded-2xl border border-black/10 bg-white/70 p-4 text-xs text-[rgb(var(--muted))]">
          <p className="font-semibold text-[rgb(var(--ink))]">
            Included files
          </p>
          <ul className="mt-2 space-y-1">
            {contents.map((item) => (
              <li key={item} className="flex gap-2">
                <span>•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {state.status === "error" && state.message ? (
        <p className="text-xs text-red-600">{state.message}</p>
      ) : null}
    </div>
  );
}
