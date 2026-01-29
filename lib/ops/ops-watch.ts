import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service";
import { sanitizeMonetisationMeta } from "@/lib/monetisation-guardrails";
import { insertOpsAuditLog } from "@/lib/ops/ops-audit-log";

export type WatchRecord = {
  requestId: string;
  userId?: string | null;
  reasonCode: string;
  note?: string | null;
  createdAt: string;
  expiresAt: string;
  createdBy?: string | null;
};

function nowUtc() {
  return new Date();
}

export async function addWatch({
  requestId,
  userId,
  reasonCode,
  note,
  ttlHours,
  actorId,
}: {
  requestId: string;
  userId?: string | null;
  reasonCode: string;
  note?: string | null;
  ttlHours: number;
  actorId: string;
}) {
  const admin = createServiceRoleClient();
  const now = nowUtc();
  const expiresAt = new Date(now.getTime() + ttlHours * 60 * 60 * 1000).toISOString();
  const meta = sanitizeMonetisationMeta({
    requestId,
    userId: userId ?? null,
    reasonCode,
    note: note ? note.slice(0, 200) : null,
    expiresAt,
    actorId,
  });
  await insertOpsAuditLog(admin, {
    actorUserId: actorId,
    targetUserId: userId ?? null,
    action: "resolution_watch",
    meta,
    createdAt: now.toISOString(),
  });
  return { expiresAt };
}

export async function listWatch({
  activeOnly = true,
  windowHours = 24,
  now = new Date(),
  userId,
  requestId,
}: {
  activeOnly?: boolean;
  windowHours?: number;
  now?: Date;
  userId?: string | null;
  requestId?: string | null;
}): Promise<WatchRecord[]> {
  const admin = createServiceRoleClient();
  const since = new Date(now.getTime() - windowHours * 60 * 60 * 1000).toISOString();
  let query = admin
    .from("ops_audit_log")
    .select("meta,created_at")
    .eq("action", "resolution_watch")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(100);
  if (userId) {
    query = query.like("meta->>userId", `%${userId}%`);
  }
  if (requestId) {
    query = query.like("meta->>requestId", `%${requestId}%`);
  }
  const { data, error } = await query;
  if (error || !data) return [];
  return data
    .map((row: any) => {
      const meta = (row.meta as Record<string, any>) ?? {};
      const expiresAt = meta.expiresAt ?? meta.expires_at ?? null;
      if (activeOnly && expiresAt && new Date(expiresAt).getTime() < now.getTime()) return null;
      return {
        requestId: meta.requestId ?? "",
        userId: meta.userId ?? null,
        reasonCode: meta.reasonCode ?? "watch",
        note: meta.note ?? null,
        createdAt: row.created_at ?? now.toISOString(),
        expiresAt: expiresAt ?? now.toISOString(),
        createdBy: meta.actorId ?? null,
      } as WatchRecord;
    })
    .filter(Boolean) as WatchRecord[];
}
