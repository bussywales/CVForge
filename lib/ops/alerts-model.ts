export type OpsAlertsModel = {
  ok: boolean;
  window?: any;
  rulesVersion?: string;
  headline?: string | null;
  firingCount?: number;
  alerts: any[];
  recentEvents: any[];
  webhookConfigured?: boolean;
  webhookConfig?: { configured: boolean; mode: string; hint: string };
  jsonError?: any;
  requestId?: string | null;
  handled?: Record<string, { at: string; by?: string | null; source?: string | null }>;
  ownership?: Record<string, { claimedByUserId: string; claimedAt: string; expiresAt: string; eventId?: string | null; note?: string | null }>;
  snoozes?: Record<string, { snoozedByUserId: string; snoozedAt: string; untilAt: string; reason?: string | null }>;
  currentUserId?: string | null;
};

export const OPS_ALERTS_DEFAULT: OpsAlertsModel = {
  ok: false,
  alerts: [],
  recentEvents: [],
  firingCount: 0,
  window: "15m",
  rulesVersion: "unknown",
  headline: null,
  requestId: null,
  jsonError: null,
  webhookConfigured: false,
  handled: {},
  ownership: {},
  snoozes: {},
  currentUserId: null,
};

export function coerceOpsAlertsModel(input: any): OpsAlertsModel {
  if (!input || typeof input !== "object") return { ...OPS_ALERTS_DEFAULT };
  const alerts = Array.isArray((input as any).alerts) ? (input as any).alerts : [];
  const handledRaw = (input as any).handled;
  const handled =
    handledRaw && typeof handledRaw === "object" && !Array.isArray(handledRaw)
      ? Object.entries(handledRaw as Record<string, any>).reduce<Record<string, { at: string; by?: string | null; source?: string | null }>>((acc, [k, v]) => {
          if (v && typeof v === "object" && typeof (v as any).at === "string")
            acc[k] = { at: (v as any).at, by: typeof (v as any).by === "string" ? (v as any).by : null, source: typeof (v as any).source === "string" ? (v as any).source : null };
          return acc;
        }, {})
      : {};
  const recentEvents = Array.isArray((input as any).recentEvents)
    ? (input as any).recentEvents.map((ev: any) => ({
        ...ev,
        handled:
          ev?.handled && typeof ev.handled === "object" && typeof ev.handled.at === "string"
            ? {
                at: ev.handled.at,
                by: typeof ev.handled.by === "string" ? ev.handled.by : null,
                source: typeof ev.handled.source === "string" ? ev.handled.source : null,
              }
            : null,
        delivery:
          ev?.delivery && typeof ev.delivery === "object" && typeof ev.delivery.status === "string" && typeof ev.delivery.at === "string"
            ? {
                status: ev.delivery.status,
                at: ev.delivery.at,
                maskedReason: typeof ev.delivery.maskedReason === "string" ? ev.delivery.maskedReason : null,
                providerRef: typeof ev.delivery.providerRef === "string" ? ev.delivery.providerRef : null,
              }
            : null,
      }))
    : [];
  const ownershipRaw = (input as any).ownership;
  const ownership =
    ownershipRaw && typeof ownershipRaw === "object" && !Array.isArray(ownershipRaw)
      ? Object.entries(ownershipRaw as Record<string, any>).reduce<
          Record<string, { claimedByUserId: string; claimedAt: string; expiresAt: string; eventId?: string | null; note?: string | null }>
        >((acc, [k, v]) => {
          if (v && typeof v === "object" && typeof (v as any).claimedAt === "string" && typeof (v as any).expiresAt === "string" && typeof (v as any).claimedByUserId === "string") {
            acc[k] = {
              claimedByUserId: (v as any).claimedByUserId,
              claimedAt: (v as any).claimedAt,
              expiresAt: (v as any).expiresAt,
              eventId: (v as any).eventId ?? null,
              note: typeof (v as any).note === "string" ? (v as any).note : null,
            };
          }
          return acc;
        }, {})
      : {};
  const snoozesRaw = (input as any).snoozes;
  const snoozes =
    snoozesRaw && typeof snoozesRaw === "object" && !Array.isArray(snoozesRaw)
      ? Object.entries(snoozesRaw as Record<string, any>).reduce<
          Record<string, { snoozedByUserId: string; snoozedAt: string; untilAt: string; reason?: string | null }>
        >((acc, [k, v]) => {
          if (v && typeof v === "object" && typeof (v as any).snoozedAt === "string" && typeof (v as any).untilAt === "string" && typeof (v as any).snoozedByUserId === "string") {
            acc[k] = {
              snoozedByUserId: (v as any).snoozedByUserId,
              snoozedAt: (v as any).snoozedAt,
              untilAt: (v as any).untilAt,
              reason: typeof (v as any).reason === "string" ? (v as any).reason : null,
            };
          }
          return acc;
        }, {})
      : {};
  return {
    ...OPS_ALERTS_DEFAULT,
    ...input,
    alerts,
    recentEvents,
    firingCount: typeof (input as any).firingCount === "number" ? (input as any).firingCount : alerts.filter((a: any) => a?.state === "firing").length,
    jsonError: (input as any).jsonError ?? null,
    requestId: (input as any).requestId ?? null,
    webhookConfigured: Boolean((input as any).webhookConfigured),
    webhookConfig:
      (input as any).webhookConfig && typeof (input as any).webhookConfig === "object"
        ? {
            configured: Boolean((input as any).webhookConfig.configured),
            mode: typeof (input as any).webhookConfig.mode === "string" ? (input as any).webhookConfig.mode : "disabled",
            hint: typeof (input as any).webhookConfig.hint === "string" ? (input as any).webhookConfig.hint : "",
          }
        : undefined,
    handled,
    ownership,
    snoozes,
    currentUserId: typeof (input as any).currentUserId === "string" ? (input as any).currentUserId : null,
  };
}
