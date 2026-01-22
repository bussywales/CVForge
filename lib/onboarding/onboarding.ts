import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { logMonetisationEvent } from "@/lib/monetisation";

export type OnboardingStepKey = "create_cv" | "export_cv" | "create_application" | "schedule_interview_optional";
export type OnboardingStepStatus = "todo" | "done";

export type OnboardingStep = {
  key: OnboardingStepKey;
  status: OnboardingStepStatus;
  completedAt?: string | null;
  optional?: boolean;
};

export type OnboardingModel = {
  steps: OnboardingStep[];
  doneCount: number;
  totalCount: number;
  skipUntil?: string | null;
};

const STEP_ORDER: OnboardingStepKey[] = ["create_cv", "export_cv", "create_application", "schedule_interview_optional"];
const OPTIONAL_STEPS: OnboardingStepKey[] = ["schedule_interview_optional"];

type ProgressRow = {
  user_id: string;
  progress: Record<string, { completedAt?: string | null }>;
  skip_until: string | null;
};

async function fetchProgressRow(admin: SupabaseClient, userId: string): Promise<ProgressRow | null> {
  const { data, error } = await admin
    .from("onboarding_progress")
    .select("user_id, progress, skip_until")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return (data as ProgressRow | null) ?? null;
}

async function upsertProgressRow(
  admin: SupabaseClient,
  userId: string,
  progress: Record<string, { completedAt?: string | null }>,
  skipUntil: string | null
) {
  const payload = {
    user_id: userId,
    progress,
    skip_until: skipUntil,
    updated_at: new Date().toISOString(),
  };
  const { error } = await admin.from("onboarding_progress").upsert(payload);
  if (error) throw error;
}

async function fetchCounts(admin: SupabaseClient, userId: string) {
  const autopacks = await admin.from("autopacks").select("id", { count: "exact", head: true }).eq("user_id", userId);
  const applications = await admin.from("applications").select("id", { count: "exact", head: true }).eq("user_id", userId);
  const exports = await admin
    .from("application_apply_checklist")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .not("cv_exported_at", "is", null);
  const interviews = await admin
    .from("applications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .ilike("status", "%interview%");
  const interviewExports = await admin
    .from("application_apply_checklist")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .not("interview_pack_exported_at", "is", null);
  return {
    autopackCount: autopacks.count ?? 0,
    applicationCount: applications.count ?? 0,
    exportCount: exports.count ?? 0,
    interviewCount: (interviews.count ?? 0) + (interviewExports.count ?? 0),
  };
}

function buildSteps(
  counts: Awaited<ReturnType<typeof fetchCounts>>,
  stored: Record<string, { completedAt?: string | null }>,
  nowIso: string
) {
  const steps: OnboardingStep[] = [];
  const progress: Record<string, { completedAt?: string | null }> = { ...stored };
  const newlyCompleted: OnboardingStepKey[] = [];

  for (const key of STEP_ORDER) {
    let status: OnboardingStepStatus = "todo";
    if (key === "create_cv" && counts.autopackCount > 0) status = "done";
    if (key === "export_cv" && counts.exportCount > 0) status = "done";
    if (key === "create_application" && counts.applicationCount > 0) status = "done";
    if (key === "schedule_interview_optional" && counts.interviewCount > 0) status = "done";

    const storedCompletedAt = stored[key]?.completedAt ?? null;
    const completedAt = status === "done" ? storedCompletedAt ?? nowIso : null;
    if (status === "done" && !storedCompletedAt) {
      newlyCompleted.push(key);
    }
    progress[key] = { completedAt };

    steps.push({
      key,
      status,
      completedAt,
      optional: OPTIONAL_STEPS.includes(key),
    });
  }

  return { steps, progress, newlyCompleted };
}

export async function getOnboardingModel({
  userId,
  now = new Date(),
  supabase: supabaseClient,
}: {
  userId: string;
  now?: Date;
  supabase?: SupabaseClient;
}): Promise<OnboardingModel> {
  const admin = supabaseClient ?? createServiceRoleClient();
  const nowIso = now.toISOString();
  const row = await fetchProgressRow(admin, userId);
  const storedProgress = (row?.progress ?? {}) as Record<string, { completedAt?: string | null }>;
  const counts = await fetchCounts(admin, userId);
  const { steps, progress, newlyCompleted } = buildSteps(counts, storedProgress, nowIso);

  const skipUntil = row?.skip_until ?? null;
  const requiredSteps = steps.filter((s) => !s.optional);
  const doneCount = requiredSteps.filter((s) => s.status === "done").length;
  const totalCount = requiredSteps.length;

  if (newlyCompleted.length > 0 || JSON.stringify(progress) !== JSON.stringify(storedProgress) || skipUntil !== (row?.skip_until ?? null)) {
    await upsertProgressRow(admin, userId, progress, skipUntil);
  }

  if (newlyCompleted.length > 0) {
    for (const step of newlyCompleted) {
      try {
        await logMonetisationEvent(admin, userId, "onboarding_step_auto_completed", { meta: { step, rule: "deterministic" } });
      } catch {
        // ignore
      }
    }
  }

  if (doneCount === totalCount && totalCount > 0 && requiredSteps.every((s) => s.completedAt)) {
    try {
      await logMonetisationEvent(admin, userId, "onboarding_completed", { meta: { completedAt: nowIso } });
    } catch {
      // ignore
    }
  }

  return {
    steps,
    doneCount,
    totalCount,
    skipUntil,
  };
}

export async function skipOnboarding({ userId, until, supabase: supabaseClient }: { userId: string; until: Date; supabase?: SupabaseClient }) {
  const admin = supabaseClient ?? createServiceRoleClient();
  const row = await fetchProgressRow(admin, userId);
  const progress = (row?.progress ?? {}) as Record<string, { completedAt?: string | null }>;
  await upsertProgressRow(admin, userId, progress, until.toISOString());
}

export async function markOnboardingStep({ userId, step, now = new Date(), supabase: supabaseClient }: { userId: string; step: OnboardingStepKey; now?: Date; supabase?: SupabaseClient }) {
  const admin = supabaseClient ?? createServiceRoleClient();
  const row = await fetchProgressRow(admin, userId);
  const progress = { ...(row?.progress ?? {}) } as Record<string, { completedAt?: string | null }>;
  progress[step] = { completedAt: now.toISOString() };
  await upsertProgressRow(admin, userId, progress, row?.skip_until ?? null);
}
