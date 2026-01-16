import type { SupabaseClient } from "@supabase/supabase-js";
import { createApplicationActivity } from "@/lib/data/application-activities";

export type MonetisationEventName =
  | "gate_shown"
  | "gate_blocked"
  | "billing_clicked"
  | "checkout_started"
  | "checkout_success"
  | "resume_banner_shown"
  | "resume_clicked"
  | "autopack_generated";

export async function logMonetisationEvent(
  supabase: SupabaseClient,
  userId: string,
  event: MonetisationEventName,
  opts?: {
    applicationId?: string | null;
    surface?: string | null;
    meta?: Record<string, any>;
  }
) {
  const applicationId = opts?.applicationId;
  if (!applicationId) return; // require application context for now
  const meta = {
    surface: opts?.surface ?? null,
    ...((opts?.meta as Record<string, any>) ?? {}),
  };
  await createApplicationActivity(supabase, userId, {
    application_id: applicationId,
    type: `monetisation.${event}`,
    channel: null,
    subject: opts?.surface ?? event,
    body: JSON.stringify(meta),
    occurred_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  } as any);
}
