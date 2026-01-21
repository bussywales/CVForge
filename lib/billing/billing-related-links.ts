export function buildRelatedIncidentsLink({
  userId,
  requestId,
  isOps,
  fromSupportParams,
}: {
  userId: string | null;
  requestId?: string | null;
  isOps?: boolean | null;
  fromSupportParams?: URLSearchParams | null;
}) {
  const supportFlag = fromSupportParams?.get("from") === "ops_support" && fromSupportParams?.get("support") === "1";
  if (!isOps && !supportFlag) return null;
  const params = new URLSearchParams();
  params.set("surface", "billing");
  params.set("range", "24h");
  if (userId) params.set("userId", userId);
  if (requestId) params.set("requestId", requestId);
  return `/app/ops/incidents?${params.toString()}`;
}

export function buildRelatedAuditsLink({ requestId, isOps }: { requestId?: string | null; isOps?: boolean | null }) {
  if (!requestId || !isOps) return null;
  const params = new URLSearchParams();
  params.set("requestId", requestId);
  params.set("range", "24h");
  return `/app/ops/audits?${params.toString()}`;
}
