import { headers } from "next/headers";
import AccessDenied from "@/components/AccessDenied";
import { makeRequestId } from "@/lib/observability/request-id";
import { getSupabaseUser } from "@/lib/data/supabase";
import { getUserRole, requireOpsAccess, type UserRole } from "@/lib/rbac";
import CasesClient from "./cases-client";

export const dynamic = "force-dynamic";

export default async function OpsCasesPage({
  searchParams,
}: {
  searchParams?: {
    status?: string | null;
    assigned?: string | null;
    priority?: string | null;
    view?: string | null;
    breached?: string | null;
    window?: string | null;
    q?: string | null;
    sort?: string | null;
  };
}) {
  const { user } = await getSupabaseUser();
  const requestId = makeRequestId(headers().get("x-request-id"));
  const canAccess = user && (await requireOpsAccess(user.id, user.email));
  const roleInfo = user ? await getUserRole(user.id) : { role: "user" as UserRole, hasRow: false };
  if (!user || !canAccess) {
    return <AccessDenied requestId={requestId} code="ACCESS_DENIED" />;
  }

  return (
    <CasesClient
      initialQuery={{
        status: searchParams?.status ?? null,
        assigned: searchParams?.assigned ?? null,
        priority: searchParams?.priority ?? null,
        view: searchParams?.view ?? null,
        breached: searchParams?.breached ?? null,
        window: searchParams?.window ?? null,
        q: searchParams?.q ?? null,
        sort: searchParams?.sort ?? null,
      }}
      viewerRole={roleInfo.role}
      viewerId={user.id}
    />
  );
}
