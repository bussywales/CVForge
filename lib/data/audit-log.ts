import type { SupabaseClient } from "@supabase/supabase-js";

export type AuditLogRecord = {
  id: string;
  user_id: string | null;
  action: string;
  meta: Record<string, unknown> | null;
  created_at: string;
};

const auditSelect = "id, user_id, action, meta, created_at";

export async function fetchLatestAuditLog(
  supabase: SupabaseClient,
  userId: string,
  action: string
): Promise<AuditLogRecord | null> {
  const { data, error } = await supabase
    .from("audit_log")
    .select(auditSelect)
    .eq("user_id", userId)
    .eq("action", action)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ?? null;
}

export async function insertAuditLog(
  supabase: SupabaseClient,
  payload: {
    user_id: string | null;
    action: string;
    meta?: Record<string, unknown> | null;
  }
) {
  const { error } = await supabase.from("audit_log").insert({
    user_id: payload.user_id,
    action: payload.action,
    meta: payload.meta ?? null,
  });

  if (error) {
    throw error;
  }
}
