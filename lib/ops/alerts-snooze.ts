import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service";
import { sanitizeMonetisationMeta } from "@/lib/monetisation-guardrails";

type SnoozeInput = {
  alertKey: string;
  windowLabel: string;
  minutes: number;
  actorId: string;
  reason?: string | null;
  now?: Date;
};

function sanitizeReason(reason?: string | null) {
  if (!reason) return null;
  const trimmed = reason.replace(/\s+/g, " ").trim().slice(0, 200);
  const urlPattern = /https?:\/\/\S+/gi;
  return trimmed.replace(urlPattern, "[url-redacted]");
}

export async function snoozeAlert({ alertKey, windowLabel, minutes, actorId, reason, now = new Date() }: SnoozeInput) {
  const admin = createServiceRoleClient();
  const nowIso = now.toISOString();
  const untilAt = new Date(now.getTime() + minutes * 60 * 1000).toISOString();
  const sanitized = sanitizeReason(reason);
  await admin.from("ops_alert_snoozes").upsert(
    {
      alert_key: alertKey,
      window_label: windowLabel,
      snoozed_by_user_id: actorId,
      snoozed_at: nowIso,
      until_at: untilAt,
      reason: sanitized,
    },
    { onConflict: "alert_key,window_label" }
  );
  return { snoozedAt: nowIso, untilAt, snoozedBy: actorId, reason: sanitized };
}

export async function unsnoozeAlert({ alertKey, windowLabel }: { alertKey: string; windowLabel: string }) {
  const admin = createServiceRoleClient();
  await admin.from("ops_alert_snoozes").delete().eq("alert_key", alertKey).eq("window_label", windowLabel);
}

export async function getSnoozeMap({ windowLabel, now = new Date() }: { windowLabel: string; now?: Date }) {
  const admin = createServiceRoleClient();
  const { data } = await admin
    .from("ops_alert_snoozes")
    .select("alert_key,window_label,snoozed_by_user_id,snoozed_at,until_at,reason")
    .eq("window_label", windowLabel)
    .gte("until_at", now.toISOString());
  const map: Record<string, { snoozedByUserId: string; snoozedAt: string; untilAt: string; reason?: string | null }> = {};
  (data ?? []).forEach((row: any) => {
    map[row.alert_key] = {
      snoozedByUserId: row.snoozed_by_user_id,
      snoozedAt: row.snoozed_at,
      untilAt: row.until_at,
      reason: sanitizeMonetisationMeta({ reason: row.reason ?? null }).reason ?? row.reason ?? null,
    };
  });
  return map;
}
