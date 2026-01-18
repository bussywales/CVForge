import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service";
import type { ApplicationActivityRecord } from "@/lib/data/application-activities";

export type IncidentSurface = "billing" | "portal" | "checkout" | "outcomes" | "outreach" | "referrals" | "other";
export type IncidentRecord = {
  requestId: string;
  at: string;
  surface: IncidentSurface;
  code: string | null;
  message: string | null;
  userId: string | null;
  emailMasked?: string | null;
  context?: Record<string, unknown>;
  eventName?: string | null;
};

const SURFACE_HINTS: Record<string, IncidentSurface> = {
  checkout_start_failed: "checkout",
  checkout_start: "checkout",
  sub_portal_open_failed: "portal",
  portal: "portal",
  billing: "billing",
  outcomes: "outcomes",
  outreach: "outreach",
  referral: "referrals",
};

function maskEmail(email: string | null | undefined) {
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

function parseActivity(activity: ApplicationActivityRecord, userEmail?: string | null): IncidentRecord | null {
  let meta: Record<string, any> = {};
  if (activity.body) {
    try {
      meta = JSON.parse(activity.body);
    } catch {
      meta = {};
    }
  }
  const requestId = meta.requestId ?? meta.request_id ?? null;
  if (!requestId) return null;
  const eventName = activity.type?.replace("monetisation.", "") ?? null;
  const surface =
    (meta.surface as IncidentSurface) ??
    (eventName && SURFACE_HINTS[eventName]) ??
    (activity.subject && SURFACE_HINTS[activity.subject]) ??
    "other";
  const code = (meta.code as string | undefined) ?? null;
  const message = (meta.message as string | undefined) ?? activity.subject ?? null;
  return {
    requestId,
    at: activity.occurred_at ?? activity.created_at,
    surface,
    code,
    message,
    userId: activity.user_id ?? null,
    emailMasked: maskEmail(userEmail),
    context: meta,
    eventName,
  };
}

export async function getRecentIncidentEvents({ limit = 20, sinceDays = 7 }: { limit?: number; sinceDays?: number }) {
  const admin = createServiceRoleClient();
  const since = new Date();
  since.setDate(since.getDate() - sinceDays);
  const { data, error } = await admin
    .from("application_activities")
    .select("id, user_id, application_id, type, channel, subject, body, occurred_at, created_at")
    .like("type", "monetisation.%")
    .gte("occurred_at", since.toISOString())
    .order("occurred_at", { ascending: false })
    .limit(limit * 2); // over-fetch to allow filtering
  if (error) return [];
  const users =
    data && data.length > 0
      ? await admin.auth.admin
          .listUsers({ page: 1, perPage: limit * 2 })
          .then((res) => res.data?.users ?? [])
          .catch(() => [])
      : [];
  const emailMap = new Map<string, string>();
  users.forEach((u) => {
    if (u.id && u.email) emailMap.set(u.id, u.email);
  });

  const incidents = (data ?? [])
    .map((row) => parseActivity(row as ApplicationActivityRecord, emailMap.get(row.user_id)))
    .filter(Boolean) as IncidentRecord[];
  return incidents.slice(0, limit);
}

export async function getIncidentByRequestId(requestId: string): Promise<IncidentRecord | null> {
  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from("application_activities")
    .select("id, user_id, application_id, type, channel, subject, body, occurred_at, created_at")
    .like("body", `%${requestId}%`)
    .order("occurred_at", { ascending: false })
    .limit(1);
  if (error || !data || data.length === 0) return null;
  const userId = data[0].user_id;
  let email: string | null = null;
  if (userId) {
    const user = await admin.auth.admin.getUserById(userId).then((res) => res.data.user).catch(() => null);
    email = user?.email ?? null;
  }
  return parseActivity(data[0] as ApplicationActivityRecord, email);
}
