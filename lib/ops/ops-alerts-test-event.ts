import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service";
import { notifyAlertTransitions } from "@/lib/ops/ops-alerts-notify";
import { sanitizeMonetisationMeta } from "@/lib/monetisation-guardrails";
import { insertOpsAuditLog } from "@/lib/ops/ops-audit-log";
import { upsertRequestContext } from "@/lib/ops/ops-request-context";

export async function createOpsAlertTestEvent({
  actorUserId,
  requestId,
  now = new Date(),
}: {
  actorUserId: string;
  requestId?: string | null;
  now?: Date;
}) {
  const admin = createServiceRoleClient();
  const nowIso = now.toISOString();
  const signals = { is_test: true, severity: "low" };
  const { data: inserted, error } = await admin
    .from("ops_alert_events")
    .insert({
      key: "ops_alert_test",
      state: "firing",
      at: nowIso,
      summary_masked: "Test alert fired",
      signals_masked: sanitizeMonetisationMeta(signals),
      window_label: "test",
      rules_version: "ops_alerts_v1_15m",
    })
    .select("id")
    .single();
  if (error) {
    throw error;
  }
  const eventId = inserted?.id ?? null;
  await notifyAlertTransitions({
    transitions: [{ key: "ops_alert_test", to: "firing" }],
    alerts: [
      {
        key: "ops_alert_test" as any,
        severity: "low",
        state: "firing",
        summary: "Test alert fired",
        signals,
        actions: [{ label: "Open alerts", href: "/app/ops/alerts", kind: "alerts" }],
      },
    ],
    previousStates: {},
    now,
    eventIdsByKey: { ops_alert_test: eventId ?? undefined } as any,
  });
  await insertOpsAuditLog(admin, {
    actorUserId,
    targetUserId: null,
    action: "ops_alert_test_fire",
    meta: { requestId },
  });
  try {
    if (requestId) {
      await upsertRequestContext({
        requestId,
        userId: actorUserId,
        source: "alerts_test",
        path: "/api/ops/alerts/test",
        meta: { eventId },
      });
    }
  } catch {
    // best-effort only
  }
  return { eventId };
}
