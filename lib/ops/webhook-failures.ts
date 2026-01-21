import "server-only";

import { createHash } from "crypto";
import { createServiceRoleClient } from "@/lib/supabase/service";

export type WebhookFailure = {
  id: string;
  requestId: string | null;
  at: string;
  code: string | null;
  group: string | null;
  actorMasked: string | null;
  userId: string | null;
  summary: string | null;
  eventIdHash: string | null;
  correlation: { checkoutSeen?: boolean; webhookSeen?: boolean; creditChanged?: boolean };
};

function maskEmail(email?: string | null) {
  if (!email) return null;
  const [local, domain] = email.split("@");
  if (!domain) return null;
  const maskedLocal = local.length <= 1 ? "*" : `${local[0]}***`;
  const domainParts = domain.split(".");
  const maskedDomain = domainParts
    .map((part, idx) => (idx === domainParts.length - 1 ? part : `${part[0] ?? ""}${"*".repeat(Math.max(0, part.length - 1))}`))
    .join(".");
  return `${maskedLocal}@${maskedDomain}`;
}

function hashValue(input?: string | null) {
  if (!input) return null;
  return createHash("sha256").update(input).digest("hex").slice(0, 12);
}

export async function listWebhookFailures({
  sinceHours = 24,
  code,
  q,
  userId,
  limit = 50,
  cursor,
  now = new Date(),
}: {
  sinceHours?: number;
  code?: string | null;
  q?: string | null;
  userId?: string | null;
  limit?: number;
  cursor?: string | null;
  now?: Date;
}): Promise<{ items: WebhookFailure[]; nextCursor: string | null }> {
  const admin = createServiceRoleClient();
  const since = new Date(now.getTime() - sinceHours * 60 * 60 * 1000).toISOString();
  const cappedLimit = Math.min(Math.max(limit, 1), 100);
  let query = admin
    .from("application_activities")
    .select("id,user_id,type,subject,body,occurred_at,created_at")
    .ilike("type", "monetisation.webhook_%")
    .gte("occurred_at", since)
    .order("occurred_at", { ascending: false })
    .limit(cappedLimit + 1);
  if (cursor) {
    query = query.lt("occurred_at", cursor);
  }
  if (code) {
    query = query.ilike("body", `%${code}%`);
  }
  if (userId) {
    query = query.ilike("body", `%${userId}%`);
  }
  if (q) {
    query = query.or(`body.ilike.%${q}%,subject.ilike.%${q}%`);
  }
  const { data, error } = await query;
  if (error || !data) return { items: [], nextCursor: null };
  const items = data.slice(0, cappedLimit).map((row: any) => {
    let meta: any = {};
    try {
      meta = JSON.parse(row.body ?? "{}");
    } catch {
      meta = {};
    }
    const requestId = meta.requestId ?? meta.request_id ?? null;
    const codeMasked = meta.code ?? meta.error_code ?? null;
    const eventIdHash = hashValue(meta.eventId ?? meta.event_id ?? requestId ?? row.id);
    return {
      id: row.id,
      requestId,
      at: row.occurred_at ?? row.created_at ?? now.toISOString(),
      code: codeMasked,
      group: meta.group ?? meta.category ?? "stripe_webhook",
      actorMasked: meta.actor ?? maskEmail(meta.actorEmail) ?? null,
      userId: meta.userId ?? row.user_id ?? null,
      summary: meta.message ?? meta.summary ?? row.subject ?? "Webhook failure",
      eventIdHash,
      correlation: {
        checkoutSeen: Boolean(meta.checkoutSeen),
        webhookSeen: Boolean(meta.webhookSeen),
        creditChanged: Boolean(meta.creditChanged),
      },
    } as WebhookFailure;
  });
  const hasMore = data.length > cappedLimit;
  const nextCursor = hasMore ? items[items.length - 1]?.at ?? null : null;
  return { items, nextCursor };
}
