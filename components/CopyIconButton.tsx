"use client";

import { useState } from "react";

type Props = {
  text: string;
  label?: string;
  className?: string;
  iconOnly?: boolean;
  onCopy?: () => void;
};

export default function CopyIconButton({
  text,
  label,
  className,
  iconOnly,
  onCopy,
}: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      if (onCopy) onCopy();
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={label ?? "Copy"}
      className={`inline-flex items-center gap-1 ${
        iconOnly
          ? "p-0 text-[rgb(var(--muted))] transition hover:text-[rgb(var(--ink))]"
          : "rounded-full border border-black/10 bg-white px-2.5 py-1 text-xs font-semibold text-[rgb(var(--ink))] hover:bg-slate-50"
      } ${className ?? ""}`}
    >
      {copied ? (
        <span className="text-[rgb(var(--accent-strong))]">✓</span>
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-[18px] w-[18px]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="1.6"
        >
          <rect x="9" y="9" width="10" height="10" rx="2" />
          <rect x="5" y="5" width="10" height="10" rx="2" />
        </svg>
      )}
      {!iconOnly && !copied ? <span>{label ?? "Copy"}</span> : null}
      {!iconOnly && copied ? <span>Copied</span> : null}
    </button>
  );
}
