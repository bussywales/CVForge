import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service";
import { listWebhookFailures } from "@/lib/ops/webhook-failures";
import { getRateLimitSummary } from "@/lib/rate-limit";

export type RagLevel = "green" | "amber" | "red";
export type RagReasonArea = "portal" | "checkout" | "webhook" | "rate_limit" | "incidents";

export type RagReason = {
  area: RagReasonArea;
  level: Exclude<RagLevel, "green">;
  code?: string | null;
  count: number;
  hint: string;
};

export type RagMetrics = {
  portalErrors: number;
  checkoutErrors: number;
  webhookFailures: number;
  webhookRepeats: number;
  rateLimit429s: number;
};

export type RagStatus = {
  overall: RagLevel;
  reasons: RagReason[];
  window: "15m";
  updatedAt: string;
  metrics: RagMetrics;
};

export function computeRagStatus(metrics: RagMetrics, now = new Date()): RagStatus {
  const reasons: RagReason[] = [];

  if (metrics.webhookFailures >= 10 || metrics.webhookRepeats >= 3) {
    reasons.push({ area: "webhook", level: "red", code: "webhook_failures", count: metrics.webhookFailures, hint: "Webhook failures spike" });
  } else if (metrics.webhookFailures >= 3 || metrics.webhookRepeats >= 1) {
    reasons.push({ area: "webhook", level: "amber", code: "webhook_failures", count: metrics.webhookFailures, hint: "Webhook failures elevated" });
  }

  if (metrics.portalErrors >= 20) {
    reasons.push({ area: "portal", level: "red", code: "portal_error", count: metrics.portalErrors, hint: "Portal errors high" });
  } else if (metrics.portalErrors >= 5) {
    reasons.push({ area: "portal", level: "amber", code: "portal_error", count: metrics.portalErrors, hint: "Portal errors elevated" });
  }

  if (metrics.checkoutErrors >= 10) {
    reasons.push({ area: "checkout", level: "red", code: "checkout_error", count: metrics.checkoutErrors, hint: "Checkout errors high" });
  } else if (metrics.checkoutErrors >= 3) {
    reasons.push({ area: "checkout", level: "amber", code: "checkout_error", count: metrics.checkoutErrors, hint: "Checkout errors elevated" });
  }

  if (metrics.rateLimit429s >= 50) {
    reasons.push({ area: "rate_limit", level: "red", code: "rate_limited", count: metrics.rateLimit429s, hint: "Rate limits high" });
  } else if (metrics.rateLimit429s >= 10) {
    reasons.push({ area: "rate_limit", level: "amber", code: "rate_limited", count: metrics.rateLimit429s, hint: "Rate limits elevated" });
  }

  const overall: RagLevel = reasons.some((r) => r.level === "red") ? "red" : reasons.some((r) => r.level === "amber") ? "amber" : "green";

  return {
    overall,
    reasons,
    window: "15m",
    updatedAt: now.toISOString(),
    metrics,
  };
}

export async function buildRagStatus(now = new Date()): Promise<RagStatus> {
  const admin = createServiceRoleClient();
  const sinceIso = new Date(now.getTime() - 15 * 60 * 1000).toISOString();

  const portalPromise = admin
    .from("application_activities")
    .select("id", { count: "exact", head: true })
    .or("type.ilike.monetisation.billing_portal_error%,type.ilike.monetisation.sub_portal_open_failed%")
    .gte("occurred_at", sinceIso);

  const checkoutPromise = admin
    .from("application_activities")
    .select("id", { count: "exact", head: true })
    .or("type.ilike.monetisation.checkout_start_failed%,type.ilike.monetisation.checkout_redirect_blocked%")
    .gte("occurred_at", sinceIso);

  const webhookFailuresPromise = listWebhookFailures({ sinceHours: 0.25, limit: 200, now });
  const rateSummary = getRateLimitSummary({ sinceMs: now.getTime() - 15 * 60 * 1000 });

  const [portalRes, checkoutRes, webhookFailures] = await Promise.all([portalPromise, checkoutPromise, webhookFailuresPromise]);

  const portalErrors = portalRes.count ?? 0;
  const checkoutErrors = checkoutRes.count ?? 0;
  const webhookFailuresCount = webhookFailures.items.length;
  const webhookRepeats = webhookFailures.items.filter((item) => (item.repeatCount ?? 1) >= 2).length;
  const rateLimit429s = Object.values(rateSummary.rateLimitHits).reduce((sum, val) => sum + (val ?? 0), 0);

  return computeRagStatus(
    {
      portalErrors,
      checkoutErrors,
      webhookFailures: webhookFailuresCount,
      webhookRepeats,
      rateLimit429s,
    },
    now
  );
}
