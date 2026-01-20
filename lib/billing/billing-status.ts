import type { BillingSettings } from "@/lib/data/billing";
import type { CreditLedgerEntry } from "@/lib/data/credits";
import { parsePortalError } from "@/lib/billing/portal-error";

export type BillingStatusSnapshot = {
  subscriptionStatus: "active" | "trialing" | "past_due" | "canceled" | "none";
  creditsAvailable: number;
  lastBillingEvent: {
    kind: "portal_error" | "checkout_success" | "checkout_error" | "subscription_change" | "credit_grant" | "usage" | "none";
    at: string | null;
    requestId?: string | null;
  } | null;
  flags: {
    portalError: boolean;
    fromOpsSupport: boolean;
  };
};

type Input = {
  settings: BillingSettings | null;
  credits: number;
  activity: CreditLedgerEntry[];
  searchParams?: Record<string, string | string[] | undefined> | null;
  now?: Date;
};

function pickSubscriptionStatus(settings: BillingSettings | null): BillingStatusSnapshot["subscriptionStatus"] {
  const raw = (settings?.subscription_status ?? "").toLowerCase();
  if (raw === "active" || raw === "trialing" || raw === "past_due" || raw === "canceled") return raw as BillingStatusSnapshot["subscriptionStatus"];
  return "none";
}

function findLastLedgerEvent(entries: CreditLedgerEntry[]) {
  if (!entries.length) return null;
  const sorted = [...entries].sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
  const positive = sorted.find((entry) => (entry.delta ?? 0) > 0);
  if (positive) {
    return { kind: "credit_grant" as const, at: positive.created_at, requestId: positive.ref };
  }
  return { kind: "usage" as const, at: sorted[0].created_at, requestId: sorted[0].ref };
}

function parseStringParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value ?? null;
}

export function buildBillingStatus(input: Input): BillingStatusSnapshot {
  const nowIso = (input.now ?? new Date()).toISOString();
  const portal = parsePortalError(input.searchParams ?? undefined);
  const fromOpsSupport = parseStringParam(input.searchParams?.from) === "ops_support" || parseStringParam(input.searchParams?.support) === "1";

  const subscriptionStatus = pickSubscriptionStatus(input.settings);
  const lastLedgerEvent = findLastLedgerEvent(input.activity);
  const checkoutSuccess = parseStringParam(input.searchParams?.success) === "1" || parseStringParam(input.searchParams?.purchased);
  const checkoutError = parseStringParam(input.searchParams?.canceled) === "1" || parseStringParam(input.searchParams?.status) === "cancel";

  let lastBillingEvent: BillingStatusSnapshot["lastBillingEvent"] = null;

  if (portal.show) {
    lastBillingEvent = { kind: "portal_error", at: nowIso, requestId: portal.requestId };
  } else if (checkoutSuccess) {
    lastBillingEvent = { kind: "checkout_success", at: nowIso };
  } else if (checkoutError) {
    lastBillingEvent = { kind: "checkout_error", at: nowIso };
  } else if (lastLedgerEvent) {
    lastBillingEvent = lastLedgerEvent;
  } else if (subscriptionStatus === "canceled" || subscriptionStatus === "past_due") {
    lastBillingEvent = { kind: "subscription_change", at: input.settings?.updated_at ?? nowIso };
  } else {
    lastBillingEvent = { kind: "none", at: null };
  }

  return {
    subscriptionStatus,
    creditsAvailable: input.credits,
    lastBillingEvent,
    flags: {
      portalError: portal.show,
      fromOpsSupport,
    },
  };
}
