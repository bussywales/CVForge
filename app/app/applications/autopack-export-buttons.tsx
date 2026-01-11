"use client";

import { useState } from "react";
import Button from "@/components/Button";

type ExportState = {
  status: "idle" | "loading" | "error";
  message?: string;
  active?: "cv" | "cover";
};

type AutopackExportButtonsProps = {
  autopackId: string;
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
}: AutopackExportButtonsProps) {
  const [state, setState] = useState<ExportState>({ status: "idle" });

  const downloadFile = async (type: "cv" | "cover") => {
    setState({ status: "loading", active: type });

    const endpoint =
      type === "cv"
        ? `/api/autopack/${autopackId}/export/cv.docx`
        : `/api/autopack/${autopackId}/export/cover-letter.docx`;
    const fallbackName =
      type === "cv"
        ? "cvforge-cv.docx"
        : "cvforge-cover-letter.docx";

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
    <div className="space-y-2">
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
      </div>
      {state.status === "error" && state.message ? (
        <p className="text-xs text-red-600">{state.message}</p>
      ) : null}
    </div>
  );
}
