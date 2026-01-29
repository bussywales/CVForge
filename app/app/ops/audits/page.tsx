import { headers } from "next/headers";
import { getSupabaseUser } from "@/lib/data/supabase";
import { requireOpsAccess } from "@/lib/rbac";
import AccessDenied from "@/components/AccessDenied";
import { makeRequestId } from "@/lib/observability/request-id";
import AuditsClient from "./audits-client";

export const dynamic = "force-dynamic";

export default async function OpsAuditsPage({
  searchParams,
}: {
  searchParams?: { userId?: string | null; q?: string | null; requestId?: string | null; eventId?: string | null };
}) {
  const { user } = await getSupabaseUser();
  const requestId = makeRequestId(headers().get("x-request-id"));
  const canAccess = user && (await requireOpsAccess(user.id, user.email));
  if (!user || !canAccess) {
    return <AccessDenied requestId={requestId} code="ACCESS_DENIED" />;
  }

  const initialQuery = searchParams?.q ?? searchParams?.requestId ?? searchParams?.eventId ?? null;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">Ops</p>
        <h1 className="text-lg font-semibold text-[rgb(var(--ink))]">Audits</h1>
        <p className="text-xs text-[rgb(var(--muted))]">Review ops actions. Masked output, read-only.</p>
      </div>
      <AuditsClient initialUserId={searchParams?.userId ?? null} initialQuery={initialQuery} />
    </div>
  );
}
