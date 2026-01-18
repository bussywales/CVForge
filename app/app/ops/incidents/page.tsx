import { notFound } from "next/navigation";
import { getSupabaseUser } from "@/lib/data/supabase";
import { getIncidentByRequestId, getRecentIncidentEvents } from "@/lib/ops/incidents";
import IncidentsClient from "./incidents-client";
import { requireOpsAccess } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function IncidentConsole({ searchParams }: { searchParams?: { requestId?: string; days?: string } }) {
  const { user } = await getSupabaseUser();
  if (!user || !(await requireOpsAccess(user.id, user.email))) {
    notFound();
  }

  const requestId = searchParams?.requestId?.trim() ?? "";
  const days = Number(searchParams?.days ?? "7");

  const recent = await getRecentIncidentEvents({ limit: 200, sinceDays: Number.isFinite(days) ? days : 7 });
  const detail = requestId ? await getIncidentByRequestId(requestId) : null;

  return <IncidentsClient incidents={recent} initialLookup={detail} />;
}
