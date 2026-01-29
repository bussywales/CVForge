import { headers } from "next/headers";
import AccessDenied from "@/components/AccessDenied";
import { makeRequestId } from "@/lib/observability/request-id";
import { getSupabaseUser } from "@/lib/data/supabase";
import { requireOpsAccess } from "@/lib/rbac";
import HelpClient from "./help-client";

export const dynamic = "force-dynamic";

export default async function OpsHelpPage() {
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
        <h1 className="text-lg font-semibold text-[rgb(var(--ink))]">Help runbook</h1>
        <p className="text-xs text-[rgb(var(--muted))]">Ops-only guidance with search, TOC, and escalation playbooks.</p>
      </div>
      <HelpClient />
    </div>
  );
}
