import type { IncidentGroup } from "@/lib/ops/incidents-shared";
import { buildSupportLink, type BillingPack, type BillingPlan, type SupportLinkKind } from "@/lib/ops/support-links";
import { OPS_PLAYBOOK_COPY, type PlaybookCopyId } from "@/lib/ops/ops-playbooks.microcopy";

type Severity = "low" | "med" | "high";

type PlaybookAction = {
  id: string;
  label: string;
  kind: "link" | "copy" | "support-link";
  href?: string | null;
  copyText?: string | null;
  supportPayload?: {
    userId?: string | null;
    kind: SupportLinkKind;
    plan?: BillingPlan | null;
    pack?: BillingPack | null;
    portal?: string | null;
    flow?: string | null;
  };
  requires?: string[];
};

export type IncidentPlaybook = {
  id: string;
  title: string;
  severityHint: Severity;
  summary: string;
  likelyCauses: string[];
  nextSteps: Array<{ label: string; detail?: string }>;
  actions: PlaybookAction[];
};

function firstIncident(group: IncidentGroup) {
  return group.incidents[0];
}

function primaryRequestId(group: IncidentGroup) {
  return group.sampleRequestIds[0] ?? group.incidents[0]?.requestId ?? null;
}

function safeLower(value: string | null | undefined) {
  return (value ?? "").toLowerCase();
}

function buildBillingLink(userId: string | null | undefined, params: { plan?: BillingPlan | null; pack?: BillingPack | null; portal?: string | null; flow?: string | null }) {
  if (!userId) return null;
  return buildSupportLink({
    kind: "billing",
    userId,
    plan: params.plan ?? null,
    pack: params.pack ?? null,
    portal: params.portal ?? null,
    flow: params.flow ?? null,
  });
}

function buildSupportLinkPayload(userId: string | null | undefined, params: { plan?: BillingPlan | null; pack?: BillingPack | null; portal?: string | null; flow?: string | null }): PlaybookAction["supportPayload"] | undefined {
  if (!userId) return undefined;
  return {
    userId,
    kind: "billing",
    plan: params.plan ?? null,
    pack: params.pack ?? null,
    portal: params.portal ?? null,
    flow: params.flow ?? null,
  };
}

function customerReply(kind: PlaybookCopyId, requestId: string | null | undefined) {
  return OPS_PLAYBOOK_COPY.customerReply[kind](requestId ?? null);
}

function portalPlaybook(group: IncidentGroup): IncidentPlaybook | null {
  const inc = firstIncident(group);
  const surface = safeLower(group.surface);
  const code = safeLower(group.code);
  const message = safeLower(group.message);
  if (!(surface.includes("portal") || code.includes("portal") || message.includes("portal") || surface.includes("stripe_portal"))) return null;
  const flow = (inc?.flow ?? (inc?.context?.flow as string | undefined) ?? (inc?.context?.from as string | undefined) ?? null) as string | null;
  const requestId = primaryRequestId(group);
  return {
    id: "stripe_portal_open",
    title: "Stripe portal failed to open",
    severityHint: "med",
    summary: "Portal session did not load or returned an error.",
    likelyCauses: [
      "Expired or invalid portal session from Stripe",
      "Return URL/flow mismatch (cancel vs resume)",
      "Recent subscription change not yet synced",
    ],
    nextSteps: [
      { label: "Regenerate a portal link with the current flow" },
      { label: "Confirm subscription status in Stripe dashboard" },
      { label: "Retry with fresh requestId if user just retried" },
    ],
    actions: [
      {
        id: "open-billing-portal",
        label: "Open Billing (portal return)",
        kind: "link",
        href: buildBillingLink(inc?.userId, { portal: "1", flow }),
        requires: inc?.userId ? [] : ["userId"],
      },
      {
        id: "support-link",
        label: "Generate support link",
        kind: "support-link",
        supportPayload: buildSupportLinkPayload(inc?.userId, { portal: "1", flow }),
        requires: inc?.userId ? [] : ["userId"],
      },
      {
        id: "open-dossier",
        label: "Open dossier",
        kind: "link",
        href: inc?.userId ? `/app/ops/users/${inc.userId}` : null,
        requires: inc?.userId ? [] : ["userId"],
      },
      {
        id: "copy-reply",
        label: "Copy customer reply",
        kind: "copy",
        copyText: customerReply("portal", requestId),
      },
    ],
  };
}

function checkoutPlaybook(group: IncidentGroup): IncidentPlaybook | null {
  const inc = firstIncident(group);
  const surface = safeLower(group.surface);
  if (!surface.includes("checkout") && !surface.includes("stripe_checkout")) return null;
  const meta = (inc?.context ?? {}) as Record<string, any>;
  const planValue = (meta.plan as string | undefined) ?? (meta.price as string | undefined) ?? (meta.priceId as string | undefined) ?? "";
  const packValue = (meta.pack as BillingPack | undefined) ?? (meta.product as BillingPack | undefined);
  const plan: BillingPlan | null = planValue.includes("80") ? "monthly_80" : planValue ? "monthly_30" : null;
  const pack: BillingPack | null = packValue && ["starter", "pro", "power"].includes(packValue) ? (packValue as BillingPack) : null;
  const requestId = primaryRequestId(group);
  return {
    id: "stripe_checkout_failed",
    title: "Checkout session failed",
    severityHint: "high",
    summary: "Checkout did not complete or failed to create a session.",
    likelyCauses: [
      "Stripe session creation failed (invalid plan/price)",
      "Return-to URL blocked or expired",
      "Customer cancelled before confirmation",
    ],
    nextSteps: [
      { label: "Regenerate checkout link with correct plan/pack" },
      { label: "Check recent incidents with same requestId" },
      { label: "Confirm Stripe customer status before retrying" },
    ],
    actions: [
      {
        id: "open-billing-checkout",
        label: "Open Billing (checkout)",
        kind: "link",
        href: buildBillingLink(inc?.userId, { plan, pack }),
        requires: inc?.userId ? [] : ["userId"],
      },
      {
        id: "support-link",
        label: "Generate support link",
        kind: "support-link",
        supportPayload: buildSupportLinkPayload(inc?.userId, { plan, pack }),
        requires: inc?.userId ? [] : ["userId"],
      },
      {
        id: "open-dossier",
        label: "Open dossier",
        kind: "link",
        href: inc?.userId ? `/app/ops/users/${inc.userId}` : null,
        requires: inc?.userId ? [] : ["userId"],
      },
      {
        id: "copy-reply",
        label: "Copy customer reply",
        kind: "copy",
        copyText: customerReply("checkout", requestId),
      },
    ],
  };
}

function webhookPlaybook(group: IncidentGroup): IncidentPlaybook | null {
  const surface = safeLower(group.surface);
  const code = safeLower(group.code);
  const message = safeLower(group.message);
  if (!(surface.includes("webhook") || code.includes("webhook") || message.includes("webhook"))) return null;
  const requestId = primaryRequestId(group);
  return {
    id: "stripe_webhook_failed",
    title: "Webhook verification failed",
    severityHint: "med",
    summary: "Stripe webhook did not verify or processing failed.",
    likelyCauses: [
      "Out-of-order events (delayed delivery)",
      "Signature mismatch or stale signing secret",
      "Processing error on our side (ledger write failed)",
    ],
    nextSteps: [
      { label: "Locate the Stripe event and replay if needed" },
      { label: "Verify signing secret and endpoint status" },
      { label: "Check incidents around the same requestId" },
    ],
    actions: [
      {
        id: "view-incidents",
        label: "View incidents",
        kind: "link",
        href: requestId ? `/app/ops/incidents?requestId=${encodeURIComponent(requestId)}` : null,
      },
      {
        id: "copy-reply",
        label: "Copy customer reply",
        kind: "copy",
        copyText: customerReply("webhook", requestId),
      },
    ],
  };
}

function creditsPlaybook(group: IncidentGroup): IncidentPlaybook | null {
  const surface = safeLower(group.surface);
  const code = safeLower(group.code);
  const message = safeLower(group.message);
  if (!(surface.includes("credits") || code.includes("credit") || message.includes("credit") || message.includes("ledger"))) return null;
  const inc = firstIncident(group);
  const requestId = primaryRequestId(group);
  return {
    id: "credits_mismatch",
    title: "Credits not applied",
    severityHint: "high",
    summary: "Credits ledger and user balance appear out of sync.",
    likelyCauses: [
      "Webhook/ledger write failed after checkout",
      "Manual adjustment missing audit entry",
      "Race condition between portal return and credit apply",
    ],
    nextSteps: [
      { label: "Reapply credits or add goodwill adjustment" },
      { label: "Check recent audits for manual changes" },
      { label: "Confirm Stripe invoice/payment succeeded" },
    ],
    actions: [
      {
        id: "open-dossier",
        label: "Open dossier",
        kind: "link",
        href: inc?.userId ? `/app/ops/users/${inc.userId}` : null,
        requires: inc?.userId ? [] : ["userId"],
      },
      {
        id: "open-billing-credits",
        label: "Open Billing",
        kind: "link",
        href: buildBillingLink(inc?.userId, { plan: null, pack: null }),
        requires: inc?.userId ? [] : ["userId"],
      },
      {
        id: "support-link",
        label: "Generate support link",
        kind: "support-link",
        supportPayload: buildSupportLinkPayload(inc?.userId, { plan: null, pack: null }),
        requires: inc?.userId ? [] : ["userId"],
      },
      {
        id: "copy-reply",
        label: "Copy customer reply",
        kind: "copy",
        copyText: customerReply("credits", requestId),
      },
    ],
  };
}

function monetisationLogPlaybook(group: IncidentGroup): IncidentPlaybook | null {
  const surface = safeLower(group.surface);
  const code = safeLower(group.code);
  const message = safeLower(group.message);
  if (!(surface.includes("monetisation") || code.includes("monetisation") || message.includes("monetisation"))) return null;
  const requestId = primaryRequestId(group);
  return {
    id: "monetisation_log_degraded",
    title: "Monetisation log degraded",
    severityHint: "low",
    summary: "Logging soft-failed; user flow may still be OK but needs verification.",
    likelyCauses: [
      "Temporary logging database outage",
      "RequestId missing during billing flow",
      "Partial event wrote without metadata",
    ],
    nextSteps: [
      { label: "Cross-check related audits for the same user/requestId" },
      { label: "Ask user to retry with fresh requestId if still blocked" },
      { label: "Verify billing balance before closing" },
    ],
    actions: [
      {
        id: "view-incidents",
        label: "View incidents",
        kind: "link",
        href: requestId ? `/app/ops/incidents?requestId=${encodeURIComponent(requestId)}` : null,
      },
      {
        id: "copy-reply",
        label: "Copy customer reply",
        kind: "copy",
        copyText: customerReply("monetisation", requestId),
      },
    ],
  };
}

export function buildIncidentPlaybook(group: IncidentGroup | null | undefined): IncidentPlaybook | null {
  if (!group || !group.incidents || group.incidents.length === 0) return null;
  return (
    portalPlaybook(group) ??
    checkoutPlaybook(group) ??
    webhookPlaybook(group) ??
    creditsPlaybook(group) ??
    monetisationLogPlaybook(group) ??
    null
  );
}

export type { PlaybookAction };
