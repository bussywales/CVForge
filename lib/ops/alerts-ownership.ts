import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service";
import { sanitizeMonetisationMeta } from "@/lib/monetisation-guardrails";

const TTL_MINUTES = 30;

type ClaimInput = {
  alertKey: string;
  windowLabel: string;
  eventId?: string | null;
  actorId: string;
  note?: string | null;
  now?: Date;
};

function sanitizeNote(note?: string | null) {
  if (!note) return null;
  const trimmed = note.replace(/\s+/g, " ").trim().slice(0, 280);
  const urlPattern = /https?:\/\/\S+/gi;
  return trimmed.replace(urlPattern, "[url-redacted]");
}

export async function claimAlert({ alertKey, windowLabel, eventId, actorId, note, now = new Date() }: ClaimInput) {
  const admin = createServiceRoleClient();
  const nowIso = now.toISOString();
  const expiresAt = new Date(now.getTime() + TTL_MINUTES * 60 * 1000).toISOString();
  const sanitizedNote = sanitizeNote(note);
  const payload = {
    alert_key: alertKey,
    window_label: windowLabel,
    event_id: eventId ?? null,
    claimed_by_user_id: actorId,
    claimed_at: nowIso,
    expires_at: expiresAt,
    note: sanitizedNote,
  };
  await admin.from("ops_alert_ownership").upsert(payload, { onConflict: "alert_key,window_label" });
  return { claimedAt: nowIso, expiresAt, claimedBy: actorId, note: sanitizedNote };
}

export async function releaseAlert({ alertKey, windowLabel, actorId, now = new Date() }: { alertKey: string; windowLabel: string; actorId: string; now?: Date }) {
  const admin = createServiceRoleClient();
  const nowIso = now.toISOString();
  await admin
    .from("ops_alert_ownership")
    .update({ released_at: nowIso })
    .eq("alert_key", alertKey)
    .eq("window_label", windowLabel)
    .eq("claimed_by_user_id", actorId);
}

export async function getAlertOwnershipMap({ windowLabel, now = new Date() }: { windowLabel: string; now?: Date }) {
  const admin = createServiceRoleClient();
  const { data } = await admin
    .from("ops_alert_ownership")
    .select("alert_key,window_label,event_id,claimed_by_user_id,claimed_at,expires_at,released_at,note")
    .eq("window_label", windowLabel)
    .gte("expires_at", now.toISOString());
  const map: Record<
    string,
    { claimedByUserId: string; claimedAt: string; expiresAt: string; eventId?: string | null; note?: string | null }
  > = {};
  (data ?? []).forEach((row: any) => {
    if (row.released_at) return;
    map[row.alert_key] = {
      claimedByUserId: row.claimed_by_user_id,
      claimedAt: row.claimed_at,
      expiresAt: row.expires_at,
      eventId: row.event_id ?? null,
      note: sanitizeMonetisationMeta({ note: row.note ?? null }).note ?? row.note ?? null,
    };
  });
  return map;
}
