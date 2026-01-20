"use client";

import CopyIconButton from "@/components/CopyIconButton";
import { ERROR_COPY } from "@/lib/microcopy/errors";

type Props = {
  title: string;
  message: string;
  hint?: string;
  requestId?: string | null;
  supportSnippet?: string | null;
  onRetry?: () => void;
  onDismiss?: () => void;
  onHelp?: () => void;
  onSupportCopy?: () => void;
};

export default function ErrorBanner({ title, message, hint, requestId, supportSnippet, onRetry, onDismiss, onHelp, onSupportCopy }: Props) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
      <div className="space-y-1">
        <p className="font-semibold">{title}</p>
        <p className="text-xs text-rose-700">{message}</p>
        {hint ? <p className="text-[11px] text-rose-700">{hint}</p> : null}
        {requestId ? (
          <div className="flex items-center gap-2 text-[11px] text-rose-700">
            <span>
              {ERROR_COPY.referenceLabel}: {requestId}
            </span>
            <CopyIconButton text={requestId} label={ERROR_COPY.copyReferenceLabel} />
          </div>
        ) : null}
        {supportSnippet ? (
          <div className="flex items-center gap-2 text-[11px] text-rose-700">
            <span>{ERROR_COPY.supportSnippetLabel}</span>
            <CopyIconButton text={supportSnippet} label={ERROR_COPY.supportSnippetLabel} onCopy={onSupportCopy} />
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {onRetry ? (
          <button
            type="button"
            className="rounded-full border border-rose-300 bg-white px-3 py-1 text-[12px] font-semibold text-rose-800"
            onClick={onRetry}
          >
            {ERROR_COPY.retryLabel}
          </button>
        ) : null}
        {onHelp ? (
          <button
            type="button"
            className="text-[12px] font-semibold text-rose-800 underline-offset-2 hover:underline"
            onClick={onHelp}
          >
            {ERROR_COPY.helpLabel}
          </button>
        ) : null}
        {onDismiss ? (
          <button
            type="button"
            className="text-[12px] font-semibold text-rose-800 underline-offset-2 hover:underline"
            onClick={onDismiss}
          >
            {ERROR_COPY.dismissLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
