import { headers } from "next/headers";
import { getSupabaseUser } from "@/lib/data/supabase";
import { requireOpsAccess } from "@/lib/rbac";
import AccessDenied from "@/components/AccessDenied";
import { makeRequestId } from "@/lib/observability/request-id";
import ActivationFunnelClient from "./activation-funnel-client";

export const dynamic = "force-dynamic";

export default async function OpsActivationPage({ searchParams }: { searchParams?: { range?: string | null } }) {
  const { user } = await getSupabaseUser();
  const requestId = makeRequestId(headers().get("x-request-id"));
  const canAccess = user && (await requireOpsAccess(user.id, user.email));
  if (!user || !canAccess) {
    return <AccessDenied requestId={requestId} code="ACCESS_DENIED" />;
  }

  const initialRange = searchParams?.range === "24h" ? "24h" : "7d";

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">Ops</p>
        <h1 className="text-lg font-semibold text-[rgb(var(--ink))]">Activation funnel</h1>
        <p className="text-xs text-[rgb(var(--muted))]">
          Read-only activation signals for the last {initialRange === "24h" ? "24 hours" : "7 days"}.
        </p>
      </div>
      <ActivationFunnelClient initialRange={initialRange} />
    </div>
  );
}
