"use client";

import { useMemo, useState } from "react";
import Button from "@/components/Button";
import type { ExportVariant } from "@/lib/export/export-utils";

type ExportState = {
  status: "idle" | "loading" | "error";
  message?: string;
  active?: "cv" | "cover" | "zip";
};

type AutopackExportButtonsProps = {
  autopackId: string;
  hasPlaceholders: boolean;
  contactComplete: boolean;
  starCount: number;
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

export default function AutopackExportButtons({
  autopackId,
  hasPlaceholders,
  contactComplete,
  starCount,
}: AutopackExportButtonsProps) {
  const [state, setState] = useState<ExportState>({ status: "idle" });
  const [variant, setVariant] = useState<ExportVariant>("standard");

  const readinessItems = useMemo(
    () => [
      {
        label: hasPlaceholders ? "Placeholders found" : "No placeholders detected",
        ok: !hasPlaceholders,
      },
      {
        label: contactComplete
          ? "Contact line complete"
          : "Add name + contact method",
        ok: contactComplete,
      },
      {
        label: `STAR answers: ${starCount}`,
        ok: starCount > 0,
      },
    ],
    [contactComplete, hasPlaceholders, starCount]
  );

  const downloadFile = async (type: "cv" | "cover" | "zip") => {
    setState({ status: "loading", active: type });

    const variantParam = `?variant=${variant}`;
    const endpoint =
      type === "cv"
        ? `/api/autopack/${autopackId}/export/cv.docx${variantParam}`
        : type === "cover"
          ? `/api/autopack/${autopackId}/export/cover-letter.docx${variantParam}`
          : `/api/autopack/${autopackId}/export/submission-pack.zip${variantParam}`;
    const fallbackName =
      type === "cv"
        ? "cvforge-cv.docx"
        : type === "cover"
          ? "cvforge-cover-letter.docx"
          : "cvforge-submission-pack.zip";

    try {
      const response = await fetch(endpoint, { credentials: "include" });

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
        fallbackName
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
      console.error("[autopack.export]", error);
      setState({
        status: "error",
        message: "Export failed. Please try again.",
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
              Export readiness
            </p>
            <div className="flex flex-wrap gap-2">
              {readinessItems.map((item) => (
                <span
                  key={item.label}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    item.ok
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {item.label}
                </span>
              ))}
            </div>
          </div>

          <label className="text-sm font-medium text-[rgb(var(--ink))]">
            Variant
            <select
              value={variant}
              onChange={(event) => setVariant(event.target.value as ExportVariant)}
              className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm"
            >
              <option value="standard">Standard</option>
              <option value="ats_minimal">ATS-Minimal</option>
            </select>
          </label>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="secondary"
          onClick={() => downloadFile("cv")}
          disabled={state.status === "loading"}
        >
          {state.status === "loading" && state.active === "cv"
            ? "Preparing CV..."
            : "Download CV (DOCX)"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => downloadFile("cover")}
          disabled={state.status === "loading"}
        >
          {state.status === "loading" && state.active === "cover"
            ? "Preparing cover letter..."
            : "Download Cover Letter (DOCX)"}
        </Button>
        <Button
          type="button"
          onClick={() => downloadFile("zip")}
          disabled={state.status === "loading"}
        >
          {state.status === "loading" && state.active === "zip"
            ? "Preparing pack..."
            : "Download Submission Pack (ZIP)"}
        </Button>
      </div>

      {state.status === "error" && state.message ? (
        <p className="text-xs text-red-600">{state.message}</p>
      ) : null}
    </div>
  );
}
