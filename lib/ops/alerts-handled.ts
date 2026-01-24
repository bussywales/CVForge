import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service";
import { sanitizeMonetisationMeta } from "@/lib/monetisation-guardrails";

export async function recordAlertHandled({
  eventId,
  actorId,
  source,
  note,
  now = new Date(),
}: {
  eventId: string;
  actorId: string;
  source: string;
  note?: string | null;
  now?: Date;
}) {
  const admin = createServiceRoleClient();
  const { data: eventRow } = await admin.from("ops_alert_events").select("id,key").eq("id", eventId).limit(1).single();
  if (!eventRow) return { ok: false, code: "NOT_FOUND" as const };

  const sinceIso = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const { data: existing } = await admin
    .from("application_activities")
    .select("id,body")
    .eq("type", "monetisation.ops_alert_handled")
    .gte("occurred_at", sinceIso)
    .like("body", `%\"eventId\":\"${eventId}\"%`)
    .limit(1);
  if (existing && existing.length) {
    return { ok: true, deduped: true, eventKey: eventRow.key };
  }

  const handledAt = now.toISOString();
  const clean = sanitizeMonetisationMeta({ note });
  await admin.from("application_activities").insert({
    application_id: actorId,
    type: "monetisation.ops_alert_handled",
    subject: "ops_alert_handled",
    channel: "ops",
    body: JSON.stringify(
      sanitizeMonetisationMeta({
        eventId,
        alertKey: eventRow.key,
        source,
        note: clean.note ?? null,
        actor: actorId,
        handledAt,
      })
    ),
    occurred_at: handledAt,
    created_at: handledAt,
  });
  return { ok: true, deduped: false, eventKey: eventRow.key };
}
