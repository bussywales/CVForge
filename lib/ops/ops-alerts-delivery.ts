import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service";
import { sanitizeMonetisationMeta } from "@/lib/monetisation-guardrails";

type DeliveryStatus = "sent" | "delivered" | "failed";

export async function recordAlertDelivery({
  eventId,
  channel = "webhook",
  status,
  at = new Date(),
  maskedReason,
  providerRef,
  windowLabel,
}: {
  eventId: string;
  channel?: string;
  status: DeliveryStatus;
  at?: Date;
  maskedReason?: string | null;
  providerRef?: string | null;
  windowLabel?: string | null;
}) {
  const admin = createServiceRoleClient();
  const clean = sanitizeMonetisationMeta({ maskedReason, providerRef });
  await admin.from("ops_alert_delivery").insert({
    event_id: eventId,
    channel,
    status,
    at: at.toISOString(),
    masked_reason: clean.maskedReason ?? null,
    provider_ref: clean.providerRef ?? null,
    window_label: windowLabel ?? null,
  });
}

export async function getLatestDeliveries(eventIds: string[]) {
  if (!eventIds.length) return {};
  const admin = createServiceRoleClient();
  const { data } = await admin
    .from("ops_alert_delivery")
    .select("event_id,status,at,masked_reason,provider_ref")
    .in("event_id", eventIds)
    .order("at", { ascending: false });
  const map: Record<string, { status: DeliveryStatus; at: string; maskedReason?: string | null; providerRef?: string | null }> = {};
  (data ?? []).forEach((row: any) => {
    if (!map[row.event_id]) {
      map[row.event_id] = {
        status: row.status,
        at: row.at,
        maskedReason: row.masked_reason ?? null,
        providerRef: row.provider_ref ?? null,
      };
    }
  });
  return map;
}
