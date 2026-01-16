"use client";

import { useState } from "react";

type Props = {
  text: string;
  label?: string;
  className?: string;
  iconOnly?: boolean;
};

export default function CopyIconButton({
  text,
  label,
  className,
  iconOnly,
}: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
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
      className={`inline-flex items-center gap-1 rounded-full border border-black/10 bg-white px-2.5 py-1 text-xs font-semibold text-[rgb(var(--ink))] hover:bg-slate-50 ${className ?? ""}`}
    >
      {copied ? (
        <span className="text-[rgb(var(--accent-strong))]">✓</span>
      ) : (
        <span className="text-base leading-none">⎘</span>
      )}
      {!iconOnly && !copied ? <span>{label ?? "Copy"}</span> : null}
      {!iconOnly && copied ? <span>Copied</span> : null}
    </button>
  );
}
