export type BillingDeepLinkIntent = {
  kind: "pack" | "plan" | "portal_return" | "flow" | "unknown";
  target?: string;
  anchor: string;
  highlightKey: string;
  intentKey: string;
};

type Search = URLSearchParams | Record<string, string | string[] | undefined | null> | undefined;

function readParam(params: Search, key: string): string | null {
  if (!params) return null;
  if (params instanceof URLSearchParams) {
    return params.get(key);
  }
  const value = (params as any)[key];
  if (Array.isArray(value)) return value[0] ?? null;
  return typeof value === "string" ? value : null;
}

export function resolveBillingDeeplink(params: URLSearchParams | Record<string, string | string[] | undefined | null> | undefined): BillingDeepLinkIntent | null {
  const from = readParam(params, "from");
  const support = readParam(params, "support");
  const portal = readParam(params, "portal");
  const flow = readParam(params, "flow");
  const plan = readParam(params, "plan");
  const pack = readParam(params, "pack");

  const allow = support === "1" || from === "ops_support" || Boolean(portal || flow || plan || pack);
  if (!allow) return null;

  let intent: BillingDeepLinkIntent | null = null;

  if (portal || flow) {
    intent = {
      kind: portal ? "portal_return" : "flow",
      target: portal || flow || undefined,
      anchor: "portal-return",
      highlightKey: portal ? "portal-return" : flow || "flow",
      intentKey: portal ? "portal" : `flow:${flow}`,
    };
  } else if (plan && (plan === "monthly_30" || plan === "monthly_80")) {
    intent = { kind: "plan", target: plan, anchor: "subscription", highlightKey: plan, intentKey: `plan:${plan}` };
  } else if (pack && ["starter", "pro", "power"].includes(pack)) {
    intent = { kind: "pack", target: pack, anchor: "packs", highlightKey: pack, intentKey: `pack:${pack}` };
  }

  if (!intent) return null;
  return {
    ...intent,
    intentKey: `support:${support === "1"}|from:${from ?? ""}|kind:${intent.kind}|target:${intent.target ?? ""}|anchor:${intent.anchor}`,
  };
}
