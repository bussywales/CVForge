import { headers } from "next/headers";
import { getSupabaseUser } from "@/lib/data/supabase";
import { makeRequestId } from "@/lib/observability/request-id";
import { requireOpsAccess } from "@/lib/rbac";
import AccessDenied from "@/components/AccessDenied";
import { listWebhookFailures } from "@/lib/ops/webhook-failures";
import WebhooksClient from "./webhooks-client";

export const dynamic = "force-dynamic";

export default async function OpsWebhooksPage({ searchParams }: { searchParams?: { since?: string; window?: string; code?: string; q?: string; signal?: string } }) {
  const { user } = await getSupabaseUser();
  const requestId = makeRequestId(headers().get("x-request-id"));
  const canAccess = user && (await requireOpsAccess(user.id, user.email));
  if (!user || !canAccess) {
    return <AccessDenied requestId={requestId} code="ACCESS_DENIED" />;
  }

  const windowParam = searchParams?.window ?? searchParams?.since;
  const sinceHours = windowParam === "7d" ? 24 * 7 : windowParam === "1h" ? 1 : windowParam === "15m" ? 0.25 : 24;
  const initialSince = (windowParam === "7d" ? "7d" : windowParam === "1h" ? "1h" : windowParam === "15m" ? "15m" : "24h") as "15m" | "1h" | "24h" | "7d";
  const initialCode = searchParams?.code ?? "";
  const initialQ = searchParams?.q ?? searchParams?.signal ?? "";
  const { items, nextCursor } = await listWebhookFailures({
    sinceHours,
    limit: 50,
    code: initialCode || null,
    q: initialQ || null,
  });

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">Ops</p>
        <h1 className="text-lg font-semibold text-[rgb(var(--ink))]">Webhook Failures</h1>
        <p className="text-xs text-[rgb(var(--muted))]">Read-only queue of Stripe webhook issues with masked refs.</p>
      </div>
      <WebhooksClient initialItems={items} initialNextCursor={nextCursor} initialSince={initialSince} initialCode={initialCode} initialQ={initialQ} />
    </div>
  );
}
