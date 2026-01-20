export type PortalErrorInfo = {
  show: boolean;
  requestId: string | null;
  code: string | null;
};

export function parsePortalError(searchParams?: Record<string, string | string[] | undefined> | null): PortalErrorInfo {
  const portalError = (searchParams as any)?.portal_error ?? null;
  const show = portalError === "1" || portalError === 1 || portalError === true;
  if (!show) return { show: false, requestId: null, code: null };
  const requestId = typeof (searchParams as any)?.req === "string" ? ((searchParams as any).req as string) : null;
  const code = typeof (searchParams as any)?.code === "string" ? ((searchParams as any).code as string) : null;
  return { show: true, requestId, code };
}

