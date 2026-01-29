import { headers } from "next/headers";
import AccessDenied from "@/components/AccessDenied";
import { makeRequestId } from "@/lib/observability/request-id";
import { getSupabaseUser } from "@/lib/data/supabase";
import { getUserRole, requireOpsAccess, type UserRole } from "@/lib/rbac";
import CaseClient from "./case-client";

export const dynamic = "force-dynamic";

export default async function OpsCasePage({
  searchParams,
}: {
  searchParams?: { requestId?: string | null; userId?: string | null; email?: string | null; window?: string | null; from?: string | null };
}) {
  const { user } = await getSupabaseUser();
  const requestId = makeRequestId(headers().get("x-request-id"));
  const canAccess = user && (await requireOpsAccess(user.id, user.email));
  const roleInfo = user ? await getUserRole(user.id) : { role: "user" as UserRole, hasRow: false };
  if (!user || !canAccess) {
    return <AccessDenied requestId={requestId} code="ACCESS_DENIED" />;
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">Ops</p>
        <h1 className="text-lg font-semibold text-[rgb(var(--ink))]">Case View</h1>
        <p className="text-xs text-[rgb(var(--muted))]">RequestId-first cockpit with alerts, incidents, audits, and billing signals.</p>
      </div>
      <CaseClient
        initialQuery={{
          requestId: searchParams?.requestId ?? null,
          userId: searchParams?.userId ?? null,
          email: searchParams?.email ?? null,
          window: searchParams?.window ?? null,
          from: searchParams?.from ?? null,
        }}
        requestId={requestId}
        viewerRole={roleInfo.role}
      />
    </div>
  );
}
