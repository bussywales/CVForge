"use client";

import { useEffect, useRef } from "react";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";

type Props = {
  applicationId: string | null;
  recommendedPackKey: string;
};

export default function BillingEventLogger({
  applicationId,
  recommendedPackKey,
}: Props) {
  const loggedRef = useRef(false);

  useEffect(() => {
    if (loggedRef.current) return;
    if (!applicationId) return;
    logMonetisationClientEvent("billing_viewed", applicationId, "billing");
    logMonetisationClientEvent("pack_recommended", applicationId, "billing", {
      packKey: recommendedPackKey,
    });
    loggedRef.current = true;
  }, [applicationId, recommendedPackKey]);

  return null;
}
