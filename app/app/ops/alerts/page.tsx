import { headers } from "next/headers";
import AccessDenied from "@/components/AccessDenied";
import ErrorBanner from "@/components/ErrorBanner";
import AlertsClient from "./alerts-client";
import { makeRequestId } from "@/lib/observability/request-id";
import { getSupabaseUser } from "@/lib/data/supabase";
import { requireOpsAccess } from "@/lib/rbac";

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
  try {
    const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const res = await fetch(new URL("/api/ops/alerts", base), { cache: "no-store", headers: { "x-request-id": requestId } });
    const body = await res.json().catch(() => null);
    if (body?.ok) {
      initial = body;
    } else {
      throw new Error(body?.error?.message ?? "Unable to load alerts");
    }
  } catch {
    initial = null;
  }

  if (!initial) {
    return <ErrorBanner title="Alerts unavailable" message="Unable to load initial alerts" requestId={requestId ?? undefined} />;
  }

  return <AlertsClient initial={initial} requestId={requestId} />;
}
