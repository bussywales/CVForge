export type OpsAlertsModel = {
  ok: boolean;
  window?: any;
  rulesVersion?: string;
  headline?: string | null;
  firingCount?: number;
  alerts: any[];
  recentEvents: any[];
  webhookConfigured?: boolean;
  jsonError?: any;
  requestId?: string | null;
  handled?: Record<string, { at: string }>;
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
};

export function coerceOpsAlertsModel(input: any): OpsAlertsModel {
  if (!input || typeof input !== "object") return { ...OPS_ALERTS_DEFAULT };
  const alerts = Array.isArray((input as any).alerts) ? (input as any).alerts : [];
  const recentEvents = Array.isArray((input as any).recentEvents) ? (input as any).recentEvents : [];
  const handledRaw = (input as any).handled;
  const handled =
    handledRaw && typeof handledRaw === "object" && !Array.isArray(handledRaw)
      ? Object.entries(handledRaw as Record<string, any>).reduce<Record<string, { at: string }>>((acc, [k, v]) => {
          if (v && typeof v === "object" && typeof (v as any).at === "string") acc[k] = { at: (v as any).at };
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
    handled,
  };
}
