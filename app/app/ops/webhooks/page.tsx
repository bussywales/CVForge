import { headers } from "next/headers";
import { getSupabaseUser } from "@/lib/data/supabase";
import { makeRequestId } from "@/lib/observability/request-id";
import { requireOpsAccess } from "@/lib/rbac";
import AccessDenied from "@/components/AccessDenied";
import { listWebhookFailures } from "@/lib/ops/webhook-failures";
import WebhooksClient from "./webhooks-client";

export const dynamic = "force-dynamic";

export default async function OpsWebhooksPage() {
  const { user } = await getSupabaseUser();
  const requestId = makeRequestId(headers().get("x-request-id"));
  const canAccess = user && (await requireOpsAccess(user.id, user.email));
  if (!user || !canAccess) {
    return <AccessDenied requestId={requestId} code="ACCESS_DENIED" />;
  }

  const { items, nextCursor } = await listWebhookFailures({ sinceHours: 24, limit: 50 });

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">Ops</p>
        <h1 className="text-lg font-semibold text-[rgb(var(--ink))]">Webhook Failures</h1>
        <p className="text-xs text-[rgb(var(--muted))]">Read-only queue of Stripe webhook issues with masked refs.</p>
      </div>
      <WebhooksClient initialItems={items} initialNextCursor={nextCursor} />
    </div>
  );
}
