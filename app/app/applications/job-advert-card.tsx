"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/Button";
import { formatDateTimeUk } from "@/lib/tracking-utils";

type FetchState = {
  status: "idle" | "loading" | "success" | "error";
  message?: string;
};

type JobAdvertCardProps = {
  applicationId: string;
  url: string;
  host: string;
  source: "fetched" | "pasted";
  status: "ok" | "failed" | "not_fetched" | "blocked";
  fetchedAt: string | null;
  chars: number;
  error: string | null;
  sourceUrl: string | null;
  blocked?: boolean;
  blockedMessage?: string | null;
};

export default function JobAdvertCard({
  applicationId,
  url,
  host,
  source,
  status,
  fetchedAt,
  chars,
  error,
  sourceUrl,
  blocked = false,
  blockedMessage = null,
}: JobAdvertCardProps) {
  const [copied, setCopied] = useState(false);
  const [fetchState, setFetchState] = useState<FetchState>({ status: "idle" });
  const router = useRouter();

  const isBlocked = blocked;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("[job advert copy]", error);
    }
  };

  const handleFetch = async () => {
  if (isBlocked) {
    setFetchState({
      status: "error",
      message:
        blockedMessage ??
        "This source blocks automated fetch. Please paste the job text manually.",
    });
    return;
  }
  setFetchState({ status: "loading" });
    try {
      const response = await fetch("/api/job/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setFetchState({
          status: "error",
          message:
            payload?.error ?? "Unable to fetch the job advert right now.",
        });
        return;
      }

      const payload = await response.json().catch(() => ({}));
      if (payload?.blocked) {
        setFetchState({
          status: "error",
          message: payload?.message ?? "This source blocks automated fetch.",
        });
        return;
      }
      const resultStatus = payload?.status ?? "ok";
      const message =
        resultStatus === "not_modified"
          ? "No changes detected since the last fetch."
          : `Fetched updated advert text (${payload?.jobTextChars ?? 0} chars).`;

      setFetchState({ status: "success", message });
      router.refresh();
    } catch (fetchError) {
      console.error("[job advert fetch]", fetchError);
      setFetchState({
        status: "error",
        message: "Unable to fetch the job advert right now.",
      });
    }
  };

  const handlePaste = () => {
    const textarea = document.getElementById("job_description");
    if (textarea) {
      textarea.scrollIntoView({ behavior: "smooth", block: "center" });
      (textarea as HTMLTextAreaElement).focus();
    }
  };

  return (
    <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-[rgb(var(--ink))]">
            {host || "Job advert"}
          </p>
          <a
            href={url}
            target="_blank"
            rel="noreferrer noopener"
            className="block max-w-[520px] truncate text-xs text-[rgb(var(--muted))] underline-offset-2 hover:underline"
          >
            {url}
          </a>
          <p className="text-xs text-[rgb(var(--muted))]">
            {source === "fetched"
              ? "Fetched snapshot is used for Role Fit and packs."
              : "Paste the description or fetch it from the link after saving."}
          </p>
          <p className="mt-1 text-[10px] text-[rgb(var(--muted))]">
            Some sites (Indeed/LinkedIn) require paste due to anti-bot restrictions.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[rgb(var(--muted))]">
            <span className="rounded-full border border-black/10 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[rgb(var(--ink))]">
              {source === "fetched" ? "Fetched" : "Pasted"}
            </span>
            <span>
              {chars.toLocaleString("en-GB")} chars
            </span>
            {fetchedAt ? (
              <span>• Last fetched {formatDateTimeUk(fetchedAt)}</span>
            ) : null}
            {sourceUrl && sourceUrl !== url ? (
              <span>• Canonical: {sourceUrl}</span>
            ) : null}
          </div>
          {isBlocked ? (
            <p className="mt-2 text-xs text-amber-700">
              {blockedMessage ??
                "This site blocks automated fetch. Please open the advert and paste the job text instead."}
            </p>
          ) : status === "failed" && error ? (
            <p className="mt-2 text-xs text-amber-700">
              Fetch failed: {error}. Paste the advert text below instead.
            </p>
          ) : null}
          {fetchState.status === "success" && fetchState.message ? (
            <p className="mt-2 text-xs text-emerald-700">
              {fetchState.message}
            </p>
          ) : null}
          {fetchState.status === "error" && fetchState.message ? (
            <p className="mt-2 text-xs text-red-600">{fetchState.message}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
          >
            Open
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={handleCopy}
            aria-live="polite"
          >
            {copied ? "Copied" : "Copy link"}
          </Button>
          <Button type="button" variant="secondary" onClick={handlePaste}>
            Paste job text
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleFetch}
            disabled={fetchState.status === "loading" || isBlocked}
            title={isBlocked ? "This site blocks automated fetch." : undefined}
          >
            {fetchState.status === "loading" ? "Fetching..." : "Fetch/Refresh"}
          </Button>
        </div>
      </div>
    </div>
  );
}
