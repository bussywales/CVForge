import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service";
import { listWebhookFailures } from "@/lib/ops/webhook-failures";
import { getRateLimitSummary } from "@/lib/rate-limit";

type RagState = "green" | "amber" | "red";
type SignalState = { count: number; state: RagState };

export type RagStatus = {
  rulesVersion: "rag_v1";
  window: { minutes: number; fromIso: string; toIso: string };
  overall: RagState;
  signals: {
    webhookFailures15m: SignalState;
    webhookErrors15m: SignalState;
    portalErrors15m: SignalState;
    checkoutErrors15m: SignalState;
    rateLimits15m: SignalState;
  };
  topIssues: Array<{ key: string; state: RagState; count: number; label: string; primaryAction: string; secondaryAction?: string | null }>;
  updatedAt: string;
};

const THRESHOLDS = {
  webhookFailRed: 5,
  webhookFailAmberMin: 1,
  webhookErrorRed: 5,
  webhookErrorAmberMin: 1,
  checkoutRed: 5,
  checkoutAmberMin: 1,
  portalRed: 10,
  portalAmberMin: 3,
  rateLimitAmberMin: 5,
} as const;

function classify(count: number, red: number, amberMin: number): RagState {
  if (count >= red) return "red";
  if (count >= amberMin) return "amber";
  return "green";
}

export function computeRagStatus(
  metrics: {
    webhookFailures: number;
    webhookErrors: number;
    portalErrors: number;
    checkoutErrors: number;
    rateLimits: number;
  },
  window: { minutes: number; fromIso: string; toIso: string },
  now = new Date()
): RagStatus {
  // Thresholds documented in spec: red on webhook/checkout errors >=5 or portal >=10; amber on smaller counts or rateLimits>=5.
  const signals = {
    webhookFailures15m: { count: metrics.webhookFailures, state: classify(metrics.webhookFailures, THRESHOLDS.webhookFailRed, THRESHOLDS.webhookFailAmberMin) },
    webhookErrors15m: { count: metrics.webhookErrors, state: classify(metrics.webhookErrors, THRESHOLDS.webhookErrorRed, THRESHOLDS.webhookErrorAmberMin) },
    portalErrors15m: { count: metrics.portalErrors, state: classify(metrics.portalErrors, THRESHOLDS.portalRed, THRESHOLDS.portalAmberMin) },
    checkoutErrors15m: { count: metrics.checkoutErrors, state: classify(metrics.checkoutErrors, THRESHOLDS.checkoutRed, THRESHOLDS.checkoutAmberMin) },
    rateLimits15m: { count: metrics.rateLimits, state: classify(metrics.rateLimits, Number.MAX_SAFE_INTEGER, THRESHOLDS.rateLimitAmberMin) },
  };

  const states = Object.values(signals).map((s) => s.state);
  const overall: RagState = states.includes("red") ? "red" : states.includes("amber") ? "amber" : "green";

  const topIssues = [
    {
      key: "webhook_failures",
      state: signals.webhookFailures15m.state,
      count: signals.webhookFailures15m.count,
      label: "Webhook failures",
      primaryAction: "/app/ops/webhooks?window=15m",
    },
    {
      key: "webhook_errors",
      state: signals.webhookErrors15m.state,
      count: signals.webhookErrors15m.count,
      label: "Webhook errors",
      primaryAction: "/app/ops/incidents?window=15m&surface=billing",
      secondaryAction: "/app/ops/webhooks?window=15m",
    },
    {
      key: "portal_errors",
      state: signals.portalErrors15m.state,
      count: signals.portalErrors15m.count,
      label: "Portal errors",
      primaryAction: "/app/ops/incidents?window=15m&surface=portal",
    },
    {
      key: "checkout_errors",
      state: signals.checkoutErrors15m.state,
      count: signals.checkoutErrors15m.count,
      label: "Checkout errors",
      primaryAction: "/app/ops/incidents?window=15m&surface=checkout",
    },
    {
      key: "rate_limits",
      state: signals.rateLimits15m.state,
      count: signals.rateLimits15m.count,
      label: "Rate limits",
      primaryAction: "/app/ops/status#limits",
      secondaryAction: "/app/ops/incidents?window=15m&surface=billing",
    },
  ]
    .filter((issue) => issue.count > 0 || issue.state !== "green")
    .sort((a, b) => (a.state === b.state ? b.count - a.count : a.state === "red" ? -1 : b.state === "red" ? 1 : a.state === "amber" ? -1 : 1))
    .slice(0, 5);

  return {
    rulesVersion: "rag_v1",
    window,
    overall,
    signals,
    topIssues,
    updatedAt: now.toISOString(),
  };
}

export async function buildRagStatus(now = new Date()): Promise<RagStatus> {
  const admin = createServiceRoleClient();
  const from = new Date(now.getTime() - 15 * 60 * 1000);
  const fromIso = from.toISOString();

  const portalPromise = admin
    .from("application_activities")
    .select("id", { count: "exact", head: true })
    .or("type.ilike.monetisation.billing_portal_error%,type.ilike.monetisation.sub_portal_open_failed%")
    .gte("occurred_at", fromIso);

  const checkoutPromise = admin
    .from("application_activities")
    .select("id", { count: "exact", head: true })
    .or("type.ilike.monetisation.checkout_start_failed%,type.ilike.monetisation.checkout_redirect_blocked%")
    .gte("occurred_at", fromIso);

  const webhookErrorsPromise = admin.from("application_activities").select("id", { count: "exact", head: true }).ilike("type", "monetisation.webhook_error%").gte("occurred_at", fromIso);

  const [portalRes, checkoutRes, webhookErrorsRes, webhookFailures, rateSummary] = await Promise.all([
    portalPromise,
    checkoutPromise,
    webhookErrorsPromise,
    listWebhookFailures({ sinceHours: 0.25, limit: 200, now }),
    Promise.resolve(getRateLimitSummary({ sinceMs: now.getTime() - 15 * 60 * 1000 })),
  ]);

  const metrics = {
    portalErrors: portalRes.count ?? 0,
    checkoutErrors: checkoutRes.count ?? 0,
    webhookErrors: webhookErrorsRes.count ?? 0,
    webhookFailures: webhookFailures.items.length,
    rateLimits: Object.values(rateSummary.rateLimitHits).reduce((sum, val) => sum + (val ?? 0), 0),
  };

  return computeRagStatus(metrics, { minutes: 15, fromIso, toIso: now.toISOString() }, now);
}
