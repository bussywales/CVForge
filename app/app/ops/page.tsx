import { headers } from "next/headers";
import { getSupabaseUser } from "@/lib/data/supabase";
import { requireOpsAccess } from "@/lib/rbac";
import AccessDenied from "@/components/AccessDenied";
import { makeRequestId } from "@/lib/observability/request-id";
import QuickLinksClient from "./quick-links-client";
import UserLookupClient from "./user-lookup-client";

export const dynamic = "force-dynamic";

export default async function OpsPage({ searchParams }: { searchParams?: { q?: string } }) {
  const { user } = await getSupabaseUser();
  const requestId = makeRequestId(headers().get("x-request-id"));
  const canAccess = user && (await requireOpsAccess(user.id, user.email));
  if (!user || !canAccess) {
    return <AccessDenied requestId={requestId} code="ACCESS_DENIED" />;
  }

  const query = searchParams?.q ?? "";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">Ops</p>
          <h1 className="text-lg font-semibold text-[rgb(var(--ink))]">Ops Command Centre</h1>
        </div>
      </div>

      <QuickLinksClient />

      <div className="rounded-2xl border border-black/10 bg-white/80 p-4">
        <UserLookupClient initialQuery={query} />
      </div>
    </div>
  );
}
