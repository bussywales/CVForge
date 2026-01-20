"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ErrorBanner from "@/components/ErrorBanner";

type Props = {
  requestId: string | null;
  supportSnippet?: string | null;
  retryHref: string;
};

export default function PortalErrorBanner({ requestId, supportSnippet, retryHref }: Props) {
  const [visible, setVisible] = useState(true);
  const router = useRouter();
  if (!visible) return null;

  const handleDismiss = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("portal_error");
    url.searchParams.delete("req");
    url.searchParams.delete("code");
    router.replace(url.pathname + url.search, { scroll: false });
    setVisible(false);
  };

  return (
    <ErrorBanner
      title="Couldn’t open Stripe portal"
      message="We couldn’t open the subscription portal. Please try again."
      requestId={requestId ?? undefined}
      supportSnippet={supportSnippet ?? undefined}
      onRetry={() => window.location.assign(retryHref)}
      onDismiss={handleDismiss}
    />
  );
}
