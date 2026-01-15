"use client";

import { useState } from "react";

type Props = {
  text: string;
  label?: string;
  className?: string;
};

export default function CopyIconButton({ text, label, className }: Props) {
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
      className={`inline-flex items-center gap-1 rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-[rgb(var(--ink))] hover:bg-slate-50 ${className ?? ""}`}
    >
      {copied ? (
        "✓ Copied"
      ) : (
        <>
          <span className="text-lg leading-none">⎘</span>
          {label ?? "Copy"}
        </>
      )}
    </button>
  );
}
