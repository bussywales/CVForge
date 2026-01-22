import "server-only";

import { createHash } from "crypto";
import { createServiceRoleClient } from "@/lib/supabase/service";
import type { OpsAlert } from "@/lib/ops/ops-alerts";

export type AlertStateRow = {
  key: string;
  state: "ok" | "firing";
  started_at: string | null;
  last_seen_at: string | null;
  last_notified_at: string | null;
  last_payload_hash: string | null;
};

export async function loadAlertStates(): Promise<Record<string, AlertStateRow>> {
  const admin = createServiceRoleClient();
  const { data } = await admin.from("ops_alert_states").select("key,state,started_at,last_seen_at,last_notified_at,last_payload_hash");
  const map: Record<string, AlertStateRow> = {};
  (data ?? []).forEach((row: any) => {
    map[row.key] = {
      key: row.key,
      state: row.state,
      started_at: row.started_at ?? null,
      last_seen_at: row.last_seen_at ?? null,
      last_notified_at: row.last_notified_at ?? null,
      last_payload_hash: row.last_payload_hash ?? null,
    };
  });
  return map;
}

export type AlertTransition = { key: string; from: "ok" | "firing"; to: "ok" | "firing"; severity: string; summary: string };

export async function saveAlertStatesAndEvents({
  computedAlerts,
  previousStates,
  now = new Date(),
  rulesVersion,
}: {
  computedAlerts: OpsAlert[];
  previousStates: Record<string, AlertStateRow>;
  now?: Date;
  rulesVersion: string;
}): Promise<{ transitions: AlertTransition[]; updatedStates: Record<string, AlertStateRow> }> {
  const admin = createServiceRoleClient();
  const nowIso = now.toISOString();
  const rows: AlertStateRow[] = [];
  const transitions: AlertTransition[] = [];
  const events: any[] = [];

  computedAlerts.forEach((alert) => {
    const prev = previousStates[alert.key];
    const fromState = prev?.state ?? "ok";
    const toState = alert.state;
    if (fromState !== toState) {
      transitions.push({ key: alert.key, from: fromState, to: toState, severity: alert.severity, summary: alert.summary });
      events.push({
        key: alert.key,
        state: toState,
        at: nowIso,
        summary_masked: alert.summary,
        signals_masked: alert.signals ?? {},
        window: "15m",
        rules_version: rulesVersion,
      });
    }
    rows.push({
      key: alert.key,
      state: toState,
      started_at: alert.startedAt ?? null,
      last_seen_at: alert.lastSeenAt ?? null,
      last_notified_at: prev?.last_notified_at ?? null,
      last_payload_hash: prev?.last_payload_hash ?? null,
    });
  });

  if (rows.length) {
    await admin.from("ops_alert_states").upsert(rows, { onConflict: "key" });
  }
  if (events.length) {
    await admin.from("ops_alert_events").insert(events);
  }

  const updatedStates: Record<string, AlertStateRow> = {};
  rows.forEach((row) => {
    updatedStates[row.key] = row;
  });
  return { transitions, updatedStates };
}

export async function updateAlertNotificationMeta(key: string, { lastNotifiedAt, payloadHash }: { lastNotifiedAt: string; payloadHash: string }) {
  const admin = createServiceRoleClient();
  await admin
    .from("ops_alert_states")
    .update({ last_notified_at: lastNotifiedAt, last_payload_hash: payloadHash })
    .eq("key", key);
}

export function hashAlertPayload(alert: OpsAlert) {
  return createHash("sha256").update(JSON.stringify({ key: alert.key, summary: alert.summary, signals: alert.signals, actions: alert.actions })).digest("hex");
}

export async function listRecentAlertEvents({ sinceHours = 24, now = new Date() }: { sinceHours?: number; now?: Date }) {
  const admin = createServiceRoleClient();
  const since = new Date(now.getTime() - sinceHours * 60 * 60 * 1000).toISOString();
  const { data } = await admin
    .from("ops_alert_events")
    .select("id,key,state,at,summary_masked,signals_masked,window,rules_version")
    .gte("at", since)
    .order("at", { ascending: false })
    .limit(200);
  return (data ?? []).map((row: any) => ({
    id: row.id,
    key: row.key,
    state: row.state,
    at: row.at,
    summary: row.summary_masked ?? "",
    signals: row.signals_masked ?? {},
    window: row.window ?? null,
    rulesVersion: row.rules_version ?? null,
  }));
}
