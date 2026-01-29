import { headers } from "next/headers";
import Link from "next/link";
import AccessDenied from "@/components/AccessDenied";
import { makeRequestId } from "@/lib/observability/request-id";
import { getSupabaseUser } from "@/lib/data/supabase";
import { requireOpsAccess } from "@/lib/rbac";
import { buildSystemStatus } from "@/lib/ops/system-status";
import SystemStatusClient from "./status-client";

export const dynamic = "force-dynamic";

export default async function OpsStatusPage() {
  const { user } = await getSupabaseUser();
  const requestId = makeRequestId(headers().get("x-request-id"));
  const canAccess = user && (await requireOpsAccess(user.id, user.email));
  if (!user || !canAccess) {
    return <AccessDenied requestId={requestId} code="ACCESS_DENIED" />;
  }
  const initialStatus = await buildSystemStatus({ vercelId: headers().get("x-vercel-id"), matchedPath: headers().get("x-matched-path") });

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">Ops</p>
        <h1 className="text-lg font-semibold text-[rgb(var(--ink))]">System status</h1>
        <p className="text-xs text-[rgb(var(--muted))]">Key billing/webhook signals for the last 24h with quick triage actions.</p>
        <p className="text-[11px] text-[rgb(var(--muted))]">
          Need push alerts? <Link href="/app/ops/alerts" className="font-semibold text-[rgb(var(--ink))] underline-offset-2 hover:underline">Open Ops Alerts</Link>.
        </p>
      </div>
      <SystemStatusClient initialStatus={initialStatus} requestId={requestId} />
    </div>
  );
}
