type PortalLinkParams = {
  flow?: string | null;
  returnTo?: string | null;
  plan?: string | null;
  from?: string | null;
  support?: string | null;
  mode?: string | null;
};

export function buildPortalLink(params?: PortalLinkParams) {
  const flow = params?.flow ?? "manage";
  const returnTo = params?.returnTo ?? "/app/billing";
  const href = new URL("/api/billing/portal", "http://localhost");
  href.searchParams.set("flow", flow);
  if (params?.plan) href.searchParams.set("plan", params.plan);
  if (params?.from) href.searchParams.set("from", params.from);
  if (params?.support) href.searchParams.set("support", params.support);
  if (params?.mode) href.searchParams.set("mode", params.mode);
  if (returnTo) href.searchParams.set("returnTo", returnTo);
  return href.pathname + href.search;
}
