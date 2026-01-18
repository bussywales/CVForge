import { notFound } from "next/navigation";
import { getSupabaseUser } from "@/lib/data/supabase";
import { isOpsAdmin } from "@/lib/ops/auth";
import { getIncidentByRequestId, getRecentIncidentEvents } from "@/lib/ops/incidents";
import IncidentsClient from "./incidents-client";

export const dynamic = "force-dynamic";

export default async function IncidentConsole({ searchParams }: { searchParams?: { requestId?: string; days?: string } }) {
  const { supabase, user } = await getSupabaseUser();
  if (!user || !isOpsAdmin(user.email)) {
    notFound();
  }

  const requestId = searchParams?.requestId?.trim() ?? "";
  const days = Number(searchParams?.days ?? "7");

  const recent = await getRecentIncidentEvents({ limit: 200, sinceDays: Number.isFinite(days) ? days : 7 });
  const detail = requestId ? await getIncidentByRequestId(requestId) : null;

  return <IncidentsClient incidents={recent} initialLookup={detail} />;
}
