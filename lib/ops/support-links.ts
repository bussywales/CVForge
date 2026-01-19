const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

const BILLING_PACKS = ["starter", "pro", "power"] as const;
const BILLING_PLANS = ["monthly_30", "monthly_80"] as const;
const SUPPORT_FOCUS_TARGETS = ["outreach", "offer-pack", "outcome", "interview-focus-session"] as const;

type BillingPack = (typeof BILLING_PACKS)[number];
type BillingPlan = (typeof BILLING_PLANS)[number];
type SupportFocus = (typeof SUPPORT_FOCUS_TARGETS)[number];

type SupportLinkKind =
  | "billing"
  | "billing_compare"
  | "billing_subscription"
  | "billing_subscription_30"
  | "billing_subscription_80"
  | "billing_topup"
  | "billing_topup_starter"
  | "billing_topup_pro"
  | "billing_topup_power"
  | "application"
  | "application_outreach"
  | "application_offer"
  | "application_outcome"
  | "application_interview"
  | "interview";

type SupportLinkParams = {
  kind: SupportLinkKind;
  userId: string;
  appId?: string | null;
  focus?: SupportFocus | null;
  pack?: BillingPack | null;
  plan?: BillingPlan | null;
  portal?: string | null;
  flow?: string | null;
  anchor?: string | null;
};

type NormalisedLinkParams = {
  kind: "billing" | "application" | "interview";
  appId?: string | null;
  focus?: SupportFocus | null;
  pack?: BillingPack | null;
  plan?: BillingPlan | null;
  portal?: string | null;
  flow?: string | null;
  anchor?: string | null;
};

const focusTabMap: Record<SupportFocus, string> = {
  outreach: "activity",
  "offer-pack": "overview",
  outcome: "overview",
  "interview-focus-session": "interview",
};

function ensureSitePath(path: string) {
  if (path.startsWith("http")) return path;
  return `${SITE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
}

function normaliseKind(params: SupportLinkParams): NormalisedLinkParams {
  const base: NormalisedLinkParams = {
    kind: "billing",
    appId: params.appId ?? null,
    focus: params.focus ?? null,
    pack: BILLING_PACKS.includes(params.pack as BillingPack) ? (params.pack as BillingPack) : null,
    plan: BILLING_PLANS.includes(params.plan as BillingPlan) ? (params.plan as BillingPlan) : null,
    portal: params.portal ?? null,
    flow: params.flow ?? null,
    anchor: params.anchor ?? null,
  };

  switch (params.kind) {
    case "billing":
    case "billing_compare":
      return { ...base, kind: "billing" };
    case "billing_subscription":
    case "billing_subscription_30":
      return { ...base, kind: "billing", plan: "monthly_30" };
    case "billing_subscription_80":
      return { ...base, kind: "billing", plan: "monthly_80" };
    case "billing_topup":
    case "billing_topup_starter":
      return { ...base, kind: "billing", pack: "starter" };
    case "billing_topup_pro":
      return { ...base, kind: "billing", pack: "pro" };
    case "billing_topup_power":
      return { ...base, kind: "billing", pack: "power" };
    case "application":
      return { ...base, kind: "application", focus: base.focus ?? "outreach" };
    case "application_outreach":
      return { ...base, kind: "application", focus: "outreach" };
    case "application_offer":
      return { ...base, kind: "application", focus: "offer-pack" };
    case "application_outcome":
      return { ...base, kind: "application", focus: "outcome" };
    case "application_interview":
      return { ...base, kind: "application", focus: "interview-focus-session" };
    case "interview":
      return { ...base, kind: "interview", focus: base.focus ?? "interview-focus-session" };
    default:
      return base;
  }
}

export function buildSupportLink(params: SupportLinkParams) {
  const resolved = normaliseKind(params);
  const baseParams = new URLSearchParams({ from: "ops_support", support: "1" });
  let path = "/app/billing";

  if (resolved.kind === "billing") {
    if (resolved.plan) baseParams.set("plan", resolved.plan);
    if (resolved.pack) baseParams.set("pack", resolved.pack);
    if (resolved.portal) baseParams.set("portal", resolved.portal);
    if (resolved.flow) baseParams.set("flow", resolved.flow);
    path = `/app/billing?${baseParams.toString()}`;
  } else if (resolved.kind === "application") {
    if (!resolved.appId) {
      throw new Error("appId required for application link");
    }
    const tab = resolved.focus ? focusTabMap[resolved.focus] ?? "overview" : "overview";
    baseParams.set("tab", tab);
    if (resolved.focus) baseParams.set("focus", resolved.focus);
    const query = baseParams.toString();
    path = `/app/applications/${resolved.appId}?${query}`;
    if (resolved.anchor) {
      path += `#${resolved.anchor}`;
    }
  } else if (resolved.kind === "interview") {
    const focus = resolved.focus ?? "interview-focus-session";
    baseParams.set("focus", focus);
    if (resolved.appId) {
      const tab = focusTabMap[focus] ?? "interview";
      baseParams.set("tab", tab);
      path = `/app/applications/${resolved.appId}?${baseParams.toString()}`;
    } else {
      path = `/app/interview?${baseParams.toString()}`;
    }
  }

  return ensureSitePath(path);
}

export type { SupportLinkKind, SupportFocus, BillingPack, BillingPlan };
export { BILLING_PACKS, BILLING_PLANS, SUPPORT_FOCUS_TARGETS };
