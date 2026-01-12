"use client";

import { useState } from "react";
import Button from "@/components/Button";

type JobAdvertCardProps = {
  url: string;
  host: string;
};

export default function JobAdvertCard({ url, host }: JobAdvertCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("[job advert copy]", error);
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
            Optional. Used for reference; content is not fetched.
          </p>
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
        </div>
      </div>
    </div>
  );
}
