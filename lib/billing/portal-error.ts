import { buildPortalLink } from "@/lib/billing/portal-link";

export type PortalErrorInfo = {
  show: boolean;
  requestId: string | null;
  code: string | null;
  retryHref: string;
};

export function parsePortalError(searchParams?: Record<string, string | string[] | undefined> | null): PortalErrorInfo {
  const portalError = (searchParams as any)?.portal_error ?? null;
  const show = portalError === "1" || portalError === 1 || portalError === true;
  const requestId = typeof (searchParams as any)?.req === "string" ? ((searchParams as any).req as string) : null;
  const code = typeof (searchParams as any)?.code === "string" ? ((searchParams as any).code as string) : null;
  const flow = typeof (searchParams as any)?.flow === "string" ? ((searchParams as any).flow as string) : "manage";
  const from = typeof (searchParams as any)?.from === "string" ? ((searchParams as any).from as string) : null;
  const support = typeof (searchParams as any)?.support === "string" ? ((searchParams as any).support as string) : null;
  const plan = typeof (searchParams as any)?.plan === "string" ? ((searchParams as any).plan as string) : null;
  const retryHref = buildPortalLink({ flow, from, support, plan, returnTo: "/app/billing" });
  if (!show) return { show: false, requestId: null, code: null, retryHref };
  return { show: true, requestId, code, retryHref };
}

