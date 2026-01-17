export type PortalReturnState = {
  portal: boolean;
  flow: string | null;
  plan: "monthly_30" | "monthly_80" | null;
  ts: string | null;
};

type InputParams =
  | URLSearchParams
  | Readonly<URLSearchParams>
  | Record<string, string | string[] | undefined>
  | null
  | undefined;

function normalise(params?: InputParams): URLSearchParams {
  if (!params) return new URLSearchParams();
  if (params instanceof URLSearchParams) return params;
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (typeof value === "undefined") return;
    if (Array.isArray(value)) {
      value.forEach((v) => search.append(key, v));
    } else {
      search.set(key, value);
    }
  });
  return search;
}

export function parsePortalReturn(params?: InputParams): PortalReturnState {
  const searchParams = normalise(params);
  const portal = searchParams.get("portal") === "1";
  const flow = searchParams.get("flow");
  const plan = searchParams.get("plan");
  const ts = searchParams.get("ts");
  const planKey = plan === "monthly_30" || plan === "monthly_80" ? plan : null;
  return { portal, flow, plan: planKey, ts };
}

export function portalDismissKey(weekKey: string) {
  return `portal_return_${weekKey}`;
}

export function portalSaveOfferDismissKey(weekKey: string) {
  return `portal_save_offer_${weekKey}`;
}

export function portalReturnKey(state: PortalReturnState, weekKey: string) {
  if (!state.portal) return "";
  if (state.ts) return `portal_${state.ts}_${state.flow ?? "none"}_${state.plan ?? "none"}`;
  return `portal_${weekKey}_${state.flow ?? "none"}_${state.plan ?? "none"}`;
}
