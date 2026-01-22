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
  source?: string;
};

async function countTable(
  supabase: SupabaseClient,
  table: string,
  timeField: string,
  since: string,
  opts?: { filters?: (query: any) => any; userIds?: string[] }
): Promise<number> {
  if (opts?.userIds && opts.userIds.length === 0) return 0;
  let query = supabase.from(table).select("id", { count: "exact", head: true }).gte(timeField, since);
  if (opts?.userIds) {
    query = query.in("user_id", opts.userIds);
  }
  if (opts?.filters) {
    query = opts.filters(query);
  }
  const { count } = await query;
  return count ?? 0;
}

function computeRate(numerator: number, denominator: number) {
  if (!denominator || denominator === 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

export async function computeFunnel({
  windowLabel,
  now = new Date(),
  supabase: supabaseClient,
  source,
}: {
  windowLabel: WindowLabel;
  now?: Date;
  supabase?: SupabaseClient;
  source?: string | null;
}): Promise<FunnelWindow> {
  const supabase = supabaseClient ?? createServiceRoleClient();
  const hours = windowLabel === "24h" ? 24 : 24 * 7;
  const since = new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString();

  let invitedCount = 0;
  let userIds: string[] | null = null;
  if (source !== undefined) {
    let profileQuery = supabase.from("profiles").select("user_id", { count: "exact" }).gte("invited_at", since);
    if (source === "unknown") {
      profileQuery = profileQuery.is("invite_source", null);
    } else {
      profileQuery = profileQuery.eq("invite_source", source);
    }
    const { data: profileRows, count: invitedCountRaw } = await profileQuery;
    invitedCount = invitedCountRaw ?? 0;
    userIds = (profileRows ?? []).map((row: any) => row.user_id);
  }

  const [invited, signedUp, createdCv, exportedCv, createdApplication, createdInterview] = await Promise.all([
    source === undefined ? countTable(supabase, "profiles", "invited_at", since) : Promise.resolve(invitedCount),
    countTable(supabase, "profiles", "created_at", since, { userIds: userIds ?? undefined }),
    countTable(supabase, "autopacks", "created_at", since, { userIds: userIds ?? undefined }),
    countTable(supabase, "application_apply_checklist", "cv_exported_at", since, {
      userIds: userIds ?? undefined,
      filters: (q) => q.not("cv_exported_at", "is", null),
    }),
    countTable(supabase, "applications", "created_at", since, { userIds: userIds ?? undefined }),
    countTable(supabase, "applications", "created_at", since, {
      userIds: userIds ?? undefined,
      filters: (q) => q.ilike("status", "%interview%"),
    }),
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
    source: source ?? undefined,
  };
}

export async function computeFunnelSummary(opts?: { now?: Date; supabase?: SupabaseClient; groupBySource?: boolean }) {
  const now = opts?.now ?? new Date();
  const supabase = opts?.supabase;
  const windows: WindowLabel[] = ["24h", "7d"];
  const results: FunnelWindow[] = [];
  if (opts?.groupBySource) {
    const baseClient = supabase ?? createServiceRoleClient();
    const { data: sourcesData } = await baseClient.from("profiles").select("invite_source, invited_at");
    const sources = Array.from(new Set(["unknown", ...(sourcesData ?? []).map((row: any) => row.invite_source ?? "unknown")]));
    for (const label of windows) {
      const perSource = await Promise.all(sources.map((src) => computeFunnel({ windowLabel: label, now, supabase, source: src ?? "unknown" })));
      results.push(...perSource.sort((a, b) => b.invited - a.invited));
    }
    return { windows: results, rulesVersion: "invite_funnel_v1_source" };
  }
  for (const label of windows) {
    results.push(await computeFunnel({ windowLabel: label, now, supabase }));
  }
  return { windows: results, rulesVersion: "invite_funnel_v1" };
}
