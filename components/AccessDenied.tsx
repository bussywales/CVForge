"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import CopyIconButton from "@/components/CopyIconButton";
import { buildSupportSnippet } from "@/lib/observability/support-snippet";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";

type Props = {
  requestId?: string | null;
  code?: string | null;
};

export default function AccessDenied({ requestId, code }: Props) {
  const snippet = useMemo(
    () =>
      requestId
        ? buildSupportSnippet({
            action: "Access denied",
            path: typeof window !== "undefined" ? window.location.pathname : "/app",
            requestId,
            code: code ?? "ACCESS_DENIED",
          })
        : null,
    [code, requestId]
  );

  useEffect(() => {
    try {
      logMonetisationClientEvent("ops_access_denied_view", null, "ops", { code, requestId });
    } catch {
      // ignore
    }
  }, [code, requestId]);

  const handleCopySnippet = () => {
    if (!snippet) return;
    try {
      logMonetisationClientEvent("ops_access_denied_copy_snippet", null, "ops", { code, requestId });
    } catch {
      // ignore
    }
  };

  return (
    <div className="rounded-3xl border border-black/10 bg-white/80 p-6 shadow-sm">
      <h1 className="text-xl font-semibold text-[rgb(var(--ink))]">Access denied</h1>
      <p className="mt-2 text-sm text-[rgb(var(--muted))]">
        Access denied. This area is restricted to authorised ops accounts.
      </p>
      {requestId ? (
        <p className="mt-1 text-xs text-[rgb(var(--muted))]">
          Reference: <span className="font-mono text-[rgb(var(--ink))]">{requestId}</span>
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Link
          href="/app"
          className="rounded-full bg-[rgb(var(--ink))] px-4 py-2 text-sm font-semibold text-white"
        >
          Back to app
        </Link>
        {snippet ? <CopyIconButton text={snippet} label="Support snippet" onCopy={handleCopySnippet} /> : null}
      </div>
    </div>
  );
}
