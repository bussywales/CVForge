export type PortalReturnState = {
  portal: boolean;
  flow: string | null;
  plan: "monthly_30" | "monthly_80" | null;
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
  const planKey = plan === "monthly_30" || plan === "monthly_80" ? plan : null;
  return { portal, flow, plan: planKey };
}

export function portalDismissKey(weekKey: string) {
  return `portal_return_${weekKey}`;
}
