export function buildPortalLink(params?: { flow?: string | null; returnTo?: string | null }) {
  const flow = params?.flow ?? "manage";
  const returnTo = params?.returnTo ?? "/app/billing";
  const href = new URL("/api/billing/portal", "http://localhost");
  href.searchParams.set("flow", flow);
  if (returnTo) href.searchParams.set("returnTo", returnTo);
  return href.pathname + href.search;
}

