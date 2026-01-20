"use client";

import CopyIconButton from "@/components/CopyIconButton";

type Props = {
  open: boolean;
  snippet: string | null;
  onClose: () => void;
  onCopy?: () => void;
  title?: string;
};

export default function BillingSupportModal({ open, snippet, onClose, onCopy, title }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/20 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-black/10 bg-white p-4 shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[rgb(var(--ink))]">{title ?? "Support snippet"}</p>
            <p className="text-xs text-[rgb(var(--muted))]">Copy and share this with support for faster triage.</p>
          </div>
          <button
            type="button"
            className="text-xs font-semibold text-[rgb(var(--muted))] underline-offset-2 hover:underline"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <div className="mt-3 space-y-2 rounded-xl border border-black/10 bg-slate-50 p-3 text-[11px] text-[rgb(var(--muted))]">
          <pre className="whitespace-pre-wrap break-words">{snippet ?? "No reference available."}</pre>
          {snippet ? <CopyIconButton text={snippet} label="Copy snippet" onCopy={onCopy} /> : null}
        </div>
      </div>
    </div>
  );
}
