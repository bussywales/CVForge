import { headers } from "next/headers";
import { getSupabaseUser } from "@/lib/data/supabase";
import { requireOpsAccess } from "@/lib/rbac";
import AccessDenied from "@/components/AccessDenied";
import { makeRequestId } from "@/lib/observability/request-id";
import { summariseResolutionOutcomes } from "@/lib/ops/ops-resolution-outcomes";
import ResolutionsClient from "./resolutions-client";

export const dynamic = "force-dynamic";

export default async function ResolutionsPage() {
  const { user } = await getSupabaseUser();
  const requestId = makeRequestId(headers().get("x-request-id"));
  const canAccess = user && (await requireOpsAccess(user.id, user.email));
  if (!user || !canAccess) {
    return <AccessDenied requestId={requestId} code="ACCESS_DENIED" />;
  }
  const initial = await summariseResolutionOutcomes({ windowHours: 24 });
  return <ResolutionsClient initialSummary={initial} />;
}
