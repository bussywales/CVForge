import { headers } from "next/headers";
import AccessDenied from "@/components/AccessDenied";
import ErrorBanner from "@/components/ErrorBanner";
import AlertsClient from "./alerts-client";
import { makeRequestId } from "@/lib/observability/request-id";
import { getSupabaseUser } from "@/lib/data/supabase";
import { requireOpsAccess } from "@/lib/rbac";
import { fetchJsonSafe } from "@/lib/http/safe-json";
import { logMonetisationEvent } from "@/lib/monetisation";

export const dynamic = "force-dynamic";

export default async function OpsAlertsPage() {
  const hdrs = headers();
  const requestId = makeRequestId(hdrs.get("x-request-id"));
  const { user } = await getSupabaseUser();
  const canAccess = user && (await requireOpsAccess(user.id, user.email));
  if (!user || !canAccess) {
    return <AccessDenied requestId={requestId} code="ACCESS_DENIED" />;
  }

  let initial: any = null;
  let initialError: { message?: string; requestId?: string | null; code?: string | null } | null = null;
  try {
    const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const res = await fetchJsonSafe<any>(new URL("/api/ops/alerts", base), { cache: "no-store", headers: { "x-request-id": requestId } });
    if (res.ok && res.json) {
      initial = res.json;
    } else {
      initialError = { message: res.error?.message ?? "Unable to load alerts", requestId: res.requestId, code: res.error?.code };
      try {
        await logMonetisationEvent(null as any, user.id, "ops_alerts_load_error", { meta: { code: res.error?.code ?? "UNKNOWN", status: res.status, hasJson: Boolean(res.json), mode: "initial" } });
      } catch {
        // ignore
      }
    }
  } catch {
    initial = null;
    initialError = { message: "Unable to load alerts", requestId, code: "FETCH_FAILED" };
  }

  return <AlertsClient initial={initial} initialError={initialError} requestId={requestId} />;
}
