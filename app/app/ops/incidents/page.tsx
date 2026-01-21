import { headers } from "next/headers";
import { getSupabaseUser } from "@/lib/data/supabase";
import { getIncidentByRequestId, getRecentIncidentEvents } from "@/lib/ops/incidents";
import IncidentsClient from "./incidents-client";
import { requireOpsAccess } from "@/lib/rbac";
import AccessDenied from "@/components/AccessDenied";
import { makeRequestId } from "@/lib/observability/request-id";
import { listRecentOutcomes } from "@/lib/ops/ops-resolution-outcomes";

export const dynamic = "force-dynamic";

export default async function IncidentConsole({ searchParams }: { searchParams?: { requestId?: string; days?: string } }) {
  const { user } = await getSupabaseUser();
  const requestId = makeRequestId(headers().get("x-request-id"));
  const canAccess = user && (await requireOpsAccess(user.id, user.email));
  if (!user || !canAccess) {
    return <AccessDenied requestId={requestId} code="ACCESS_DENIED" />;
  }

  const lookupId = searchParams?.requestId?.trim() ?? "";
  const days = Number(searchParams?.days ?? "7");

  const recent = await getRecentIncidentEvents({ limit: 200, sinceDays: Number.isFinite(days) ? days : 7 });
  const detail = lookupId ? await getIncidentByRequestId(lookupId) : null;
  const outcomes = await listRecentOutcomes({ requestId: lookupId || detail?.requestId || null, limit: 3 });

  return <IncidentsClient incidents={recent} initialLookup={detail} initialRequestId={lookupId || null} initialOutcomes={outcomes} />;
}
