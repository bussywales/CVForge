import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/service";

type WindowLabel = "24h" | "7d";

export type FunnelWindow = {
  windowLabel: WindowLabel;
  invited: number;
  signed_up: number;
  created_cv: number;
  exported_cv: number;
  created_application: number;
  created_interview: number;
  conversion: {
    invitedToSignup: number;
    signupToCv: number;
    cvToExport: number;
    exportToApplication: number;
  };
};

async function countTable(
  supabase: SupabaseClient,
  table: string,
  timeField: string,
  since: string,
  filters?: (query: any) => any
): Promise<number> {
  let query = supabase.from(table).select("id", { count: "exact", head: true }).gte(timeField, since);
  if (filters) {
    query = filters(query);
  }
  const { count } = await query;
  return count ?? 0;
}

function computeRate(numerator: number, denominator: number) {
  if (!denominator || denominator === 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

export async function computeFunnel({ windowLabel, now = new Date(), supabase: supabaseClient }: { windowLabel: WindowLabel; now?: Date; supabase?: SupabaseClient }): Promise<FunnelWindow> {
  const supabase = supabaseClient ?? createServiceRoleClient();
  const hours = windowLabel === "24h" ? 24 : 24 * 7;
  const since = new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString();

  const [invited, signedUp, createdCv, exportedCv, createdApplication, createdInterview] = await Promise.all([
    countTable(supabase, "early_access_invites", "invited_at", since, (q) => q.is("revoked_at", null)),
    countTable(supabase, "profiles", "created_at", since),
    countTable(supabase, "autopacks", "created_at", since),
    countTable(supabase, "application_apply_checklist", "cv_exported_at", since, (q) => q.not("cv_exported_at", "is", null)),
    countTable(supabase, "applications", "created_at", since),
    countTable(
      supabase,
      "applications",
      "created_at",
      since,
      (q) => q.ilike("status", "%interview%")
    ),
  ]);

  return {
    windowLabel,
    invited,
    signed_up: signedUp,
    created_cv: createdCv,
    exported_cv: exportedCv,
    created_application: createdApplication,
    created_interview: createdInterview,
    conversion: {
      invitedToSignup: computeRate(signedUp, invited || 1),
      signupToCv: computeRate(createdCv, signedUp || 1),
      cvToExport: computeRate(exportedCv, createdCv || 1),
      exportToApplication: computeRate(createdApplication, exportedCv || 1),
    },
  };
}

export async function computeFunnelSummary(opts?: { now?: Date; supabase?: SupabaseClient }) {
  const now = opts?.now ?? new Date();
  const supabase = opts?.supabase;
  const windows: WindowLabel[] = ["24h", "7d"];
  const results: FunnelWindow[] = [];
  for (const label of windows) {
    results.push(await computeFunnel({ windowLabel: label, now, supabase }));
  }
  return { windows: results, rulesVersion: "invite_funnel_v1" };
}
