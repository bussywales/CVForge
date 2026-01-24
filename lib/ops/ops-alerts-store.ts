import "server-only";

import { createHash } from "crypto";
import { createServiceRoleClient } from "@/lib/supabase/service";
import type { OpsAlert } from "@/lib/ops/ops-alerts";
import { sanitizeMonetisationMeta } from "@/lib/monetisation-guardrails";
import { getLatestDeliveries } from "@/lib/ops/ops-alerts-delivery";

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
}): Promise<{ transitions: AlertTransition[]; updatedStates: Record<string, AlertStateRow>; eventIdsByKey: Record<string, string> }> {
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
        signals_masked: sanitizeMonetisationMeta(alert.signals ?? {}),
        window_label: "15m",
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
  let eventIdsByKey: Record<string, string> = {};
  if (events.length) {
    const { data: inserted } = await admin.from("ops_alert_events").insert(events).select("id,key");
    eventIdsByKey = (inserted ?? []).reduce<Record<string, string>>((acc, row: any) => {
      if (row?.key && row?.id) acc[row.key] = row.id;
      return acc;
    }, {});
  }

  const updatedStates: Record<string, AlertStateRow> = {};
  rows.forEach((row) => {
    updatedStates[row.key] = row;
  });
  return { transitions, updatedStates, eventIdsByKey };
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
    .select("id,key,state,at,summary_masked,signals_masked,window_label,rules_version")
    .gte("at", since)
    .order("at", { ascending: false })
    .limit(200);
  const deliveries = await getLatestDeliveries((data ?? []).map((d: any) => d.id));
  return (data ?? []).map((row: any) => {
    const signals = row.signals_masked && typeof row.signals_masked === "object" ? row.signals_masked : {};
    const isTest = Boolean((signals as any).is_test ?? (signals as any).test ?? false);
    const severity = (signals as any).severity ?? null;
    const delivery = deliveries[row.id] ?? null;
    return {
      id: row.id,
      key: row.key,
      state: row.state,
      at: row.at,
      summary: row.summary_masked ?? "",
      signals,
      window: row.window_label ?? null,
      rulesVersion: row.rules_version ?? null,
      isTest,
      severity,
      delivery,
    };
  });
}

export async function listHandledAlertEvents({ sinceHours = 24, now = new Date() }: { sinceHours?: number; now?: Date }) {
  const admin = createServiceRoleClient();
  const since = new Date(now.getTime() - sinceHours * 60 * 60 * 1000).toISOString();
  const { data } = await admin
    .from("application_activities")
    .select("id,body,occurred_at,created_at")
    .eq("type", "monetisation.ops_alert_handled")
    .gte("occurred_at", since)
    .order("occurred_at", { ascending: false })
    .limit(200);
  const handled: Record<string, { at: string; by?: string | null; source?: string | null }> = {};
  (data ?? []).forEach((row: any) => {
    try {
      const meta = JSON.parse(row.body ?? "{}");
      if (typeof meta?.eventId === "string") {
        const at = row.occurred_at ?? row.created_at ?? now.toISOString();
        handled[meta.eventId] = { at, by: typeof meta.actor === "string" ? meta.actor : null, source: typeof meta.source === "string" ? meta.source : null };
      }
    } catch {
      /* ignore */
    }
  });
  return handled;
}
