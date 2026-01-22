import { headers } from "next/headers";
import { makeRequestId } from "@/lib/observability/request-id";
import { requireOpsAccess } from "@/lib/rbac";
import { getSupabaseUser } from "@/lib/data/supabase";
import AccessDenied from "@/components/AccessDenied";
import FunnelPanel from "../funnel-panel";

export const dynamic = "force-dynamic";

export default async function OpsFunnelPage() {
  const { user } = await getSupabaseUser();
  const requestId = makeRequestId(headers().get("x-request-id"));
  const canAccess = user && (await requireOpsAccess(user.id, user.email));
  if (!user || !canAccess) {
    return <AccessDenied requestId={requestId} code="ACCESS_DENIED" />;
  }
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">Ops</p>
        <h1 className="text-lg font-semibold text-[rgb(var(--ink))]">Funnel</h1>
      </div>
      <FunnelPanel />
    </div>
  );
}
