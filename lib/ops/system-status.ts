import { createServiceRoleClient } from "@/lib/supabase/service";
import { listWebhookFailures } from "@/lib/ops/webhook-failures";

export type SystemStatus = {
  deployment: { vercelId?: string | null; matchedPath?: string | null };
  now: string;
  health: {
    billingRecheck429_24h: number;
    portalErrors_24h: number;
    webhookFailures_24h: number;
    webhookRepeats_24h: number;
    incidents_24h: number;
    audits_24h: number;
  };
  queues: { webhookFailuresQueue: { count24h: number; lastSeenAt?: string | null; firstSeenAt?: string | null; repeatsTop?: number | null } };
  notes: string[];
};

export async function buildSystemStatus({ now = new Date(), vercelId, matchedPath }: { now?: Date; vercelId?: string | null; matchedPath?: string | null }): Promise<SystemStatus> {
  const admin = createServiceRoleClient();
  const since24 = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const billingRecheck429Promise = admin
    .from("application_activities")
    .select("id", { count: "exact", head: true })
    .ilike("type", "monetisation.billing_recheck_rate_limited%")
    .gte("occurred_at", since24);
  const portalErrorsPromise = admin
    .from("application_activities")
    .select("id", { count: "exact", head: true })
    .ilike("type", "monetisation.billing_portal_error%")
    .gte("occurred_at", since24);
  const webhookFailuresPromise = admin
    .from("application_activities")
    .select("id", { count: "exact", head: true })
    .or("type.ilike.monetisation.webhook_error%,type.ilike.monetisation.webhook_failure%")
    .gte("occurred_at", since24);
  const incidentsPromise = admin
    .from("application_activities")
    .select("id", { count: "exact", head: true })
    .ilike("type", "monetisation.%")
    .gte("occurred_at", since24);
  const auditsPromise = admin.from("ops_audit_log").select("id", { count: "exact", head: true }).gte("created_at", since24);

  const [billingRecheck429Res, portalErrorsRes, webhookFailuresRes, incidentsRes, auditsRes, webhookQueue] = await Promise.all([
    billingRecheck429Promise,
    portalErrorsPromise,
    webhookFailuresPromise,
    incidentsPromise,
    auditsPromise,
    listWebhookFailures({ sinceHours: 24, limit: 200, now }),
  ]);

  const billingRecheck429_24h = billingRecheck429Res.count ?? 0;
  const portalErrors_24h = portalErrorsRes.count ?? 0;
  const webhookFailures_24h = webhookFailuresRes.count ?? 0;
  const incidents_24h = incidentsRes.count ?? 0;
  const audits_24h = auditsRes.count ?? 0;
  const webhookRepeats_24h = (webhookQueue.items ?? []).filter((item) => (item.repeatCount ?? 1) > 1).length;
  const lastSeenAt =
    webhookQueue.items.length > 0 ? webhookQueue.items.reduce((latest, item) => (latest && latest > (item.lastSeenAt ?? item.at ?? "") ? latest : item.lastSeenAt ?? item.at ?? latest), null as string | null) : null;
  const firstSeenAt =
    webhookQueue.items.length > 0 ? webhookQueue.items.reduce((earliest, item) => (!earliest || (item.firstSeenAt ?? item.at ?? "") < earliest ? item.firstSeenAt ?? item.at ?? earliest : earliest), null as string | null) : null;
  const repeatsTop =
    webhookQueue.items.length > 0 ? webhookQueue.items.reduce((max, item) => Math.max(max, item.repeatCount ?? 1), 0) : null;

  const notes: string[] = [];
  if (webhookFailures_24h > 20) notes.push("Webhook failures elevated");
  if ((repeatsTop ?? 0) >= 3) notes.push("Webhook repeats observed");
  if (billingRecheck429_24h > 5) notes.push("Billing recheck rate limits detected");
  if (portalErrors_24h > 5) notes.push("Portal errors elevated");

  return {
    deployment: { vercelId: vercelId ?? null, matchedPath: matchedPath ?? null },
    now: now.toISOString(),
    health: {
      billingRecheck429_24h,
      portalErrors_24h,
      webhookFailures_24h,
      webhookRepeats_24h,
      incidents_24h,
      audits_24h,
    },
    queues: { webhookFailuresQueue: { count24h: webhookQueue.items.length, lastSeenAt, firstSeenAt, repeatsTop } },
    notes,
  };
}
