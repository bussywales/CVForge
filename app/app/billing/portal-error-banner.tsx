"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ErrorBanner from "@/components/ErrorBanner";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";

type Props = {
  requestId: string | null;
  supportSnippet?: string | null;
  retryHref: string;
  code?: string | null;
};

export default function PortalErrorBanner({ requestId, supportSnippet, retryHref, code }: Props) {
  const [visible, setVisible] = useState(true);
  const router = useRouter();

  useEffect(() => {
    logMonetisationClientEvent("billing_portal_error_banner_view", null, "billing", { requestId: requestId ?? null, code: code ?? null });
  }, [code, requestId]);

  if (!visible) return null;

  const handleDismiss = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("portal_error");
    url.searchParams.delete("req");
    url.searchParams.delete("code");
    logMonetisationClientEvent("billing_portal_error_banner_dismiss", null, "billing", { requestId: requestId ?? null, code: code ?? null });
    router.replace(url.pathname + url.search, { scroll: false });
    setVisible(false);
  };

  return (
    <ErrorBanner
      title="Couldn’t open Stripe portal"
      message="We couldn’t open the subscription portal. Try again or share this reference with support."
      hint={code ? `Code: ${code}` : undefined}
      requestId={requestId ?? undefined}
      supportSnippet={supportSnippet ?? undefined}
      onSupportCopy={() => logMonetisationClientEvent("billing_support_snippet_copy", null, "billing", { requestId: requestId ?? null })}
      onRetry={() => {
        logMonetisationClientEvent("billing_portal_error_retry_click", null, "billing", { requestId: requestId ?? null, code: code ?? null });
        window.location.assign(retryHref);
      }}
      onDismiss={handleDismiss}
    />
  );
}
