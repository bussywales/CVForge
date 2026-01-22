import { headers } from "next/headers";
import { getSupabaseUser } from "@/lib/data/supabase";
import { getIncidentByRequestId, getRecentIncidentEvents } from "@/lib/ops/incidents";
import IncidentsClient from "./incidents-client";
import { requireOpsAccess } from "@/lib/rbac";
import AccessDenied from "@/components/AccessDenied";
import { makeRequestId } from "@/lib/observability/request-id";
import { listRecentOutcomes } from "@/lib/ops/ops-resolution-outcomes";
import { listWatch } from "@/lib/ops/ops-watch";

export const dynamic = "force-dynamic";

export default async function IncidentConsole({ searchParams }: { searchParams?: { requestId?: string; days?: string; window?: string } }) {
  const { user } = await getSupabaseUser();
  const requestId = makeRequestId(headers().get("x-request-id"));
  const canAccess = user && (await requireOpsAccess(user.id, user.email));
  if (!user || !canAccess) {
    return <AccessDenied requestId={requestId} code="ACCESS_DENIED" />;
  }

  const lookupId = searchParams?.requestId?.trim() ?? "";
  const days = Number(searchParams?.days ?? "7");
  const windowParam = (searchParams?.window ?? "").toLowerCase();
  let sinceDays = Number.isFinite(days) ? days : 7;
  let initialTime: "0.25" | "1" | "24" | "168" = "24";
  if (windowParam === "15m") {
    sinceDays = 15 / 60 / 24;
    initialTime = "0.25";
  } else if (windowParam === "1h") {
    sinceDays = 1 / 24;
    initialTime = "1";
  } else if (windowParam === "24h") {
    sinceDays = 1;
    initialTime = "24";
  } else if (windowParam === "7d") {
    sinceDays = 7;
    initialTime = "168";
  } else if (sinceDays === 1) {
    initialTime = "24";
  } else if (sinceDays >= 7) {
    initialTime = "168";
  }

  const recent = await getRecentIncidentEvents({ limit: 200, sinceDays });
  const detail = lookupId ? await getIncidentByRequestId(lookupId) : null;
  const outcomes = await listRecentOutcomes({ requestId: lookupId || detail?.requestId || null, limit: 3 });
  const watch = await listWatch({ activeOnly: true, windowHours: 24 });

  return (
    <IncidentsClient
      incidents={recent}
      initialLookup={detail}
      initialRequestId={lookupId || null}
      initialOutcomes={outcomes}
      initialWatch={watch}
      initialTime={initialTime}
    />
  );
}
