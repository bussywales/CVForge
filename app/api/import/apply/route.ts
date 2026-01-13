import { NextResponse } from "next/server";
import { z } from "zod";
import { createAchievement } from "@/lib/data/achievements";
import { insertAuditLog } from "@/lib/data/audit-log";
import { ensureProfile } from "@/lib/data/profile";
import { createWorkHistory, listWorkHistory } from "@/lib/data/work-history";
import { createServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const achievementSchema = z.object({
  title: z.string().trim().min(3),
  situation: z.string().trim().optional(),
  task: z.string().trim().optional(),
  action: z.string().trim().min(5),
  result: z.string().trim().optional(),
  metrics: z.string().trim().optional(),
});

const applySchema = z.object({
  profile: z
    .object({
      full_name: z.string().trim().optional(),
      headline: z.string().trim().optional(),
    })
    .optional(),
  achievements: z.array(achievementSchema).optional(),
  work_history: z
    .array(
      z.object({
        job_title: z.string().trim().min(2),
        company: z.string().trim().min(2),
        location: z.string().trim().optional(),
        start_date: z.string().trim().min(4),
        end_date: z.string().trim().optional(),
        is_current: z.boolean(),
        summary: z.string().trim().optional(),
        bullets: z.array(z.string().trim()).optional(),
      })
    )
    .optional(),
  extracted: z
    .object({
      sectionsDetected: z.array(z.string()).optional(),
      warnings: z.array(z.string()).optional(),
    })
    .optional(),
  selections: z.object({
    applyProfile: z.boolean(),
    applyAchievements: z.boolean(),
    selectedAchievementIndexes: z.array(z.number().int().nonnegative()).optional(),
    applyWorkHistory: z.boolean().optional(),
    selectedWorkHistoryIndexes: z.array(z.number().int().nonnegative()).optional(),
  }),
});

export async function POST(request: Request) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = applySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload." },
      { status: 400 }
    );
  }

  const { selections, profile, achievements = [], work_history = [] } = parsed.data;
  let updatedProfile = false;
  let createdAchievements = 0;
  let createdWorkHistory = 0;

  try {
    if (selections.applyProfile && profile) {
      const updates: Record<string, string> = {};
      if (profile.full_name && profile.full_name.trim()) {
        updates.full_name = profile.full_name.trim();
      }
      if (profile.headline && profile.headline.trim()) {
        updates.headline = profile.headline.trim();
      }

      if (Object.keys(updates).length > 0) {
        await ensureProfile(supabase, user.id);
        const { error } = await supabase
          .from("profiles")
          .update(updates)
          .eq("user_id", user.id);

        if (error) {
          throw error;
        }

        updatedProfile = true;
      }
    }

    if (selections.applyAchievements) {
      const selectedIndexes = new Set(
        selections.selectedAchievementIndexes ?? achievements.map((_, index) => index)
      );
      const toCreate = achievements
        .map((achievement, index) => ({ achievement, index }))
        .filter(({ index }) => selectedIndexes.has(index))
        .map(({ achievement }) => normalizeAchievement(achievement))
        .filter((achievement): achievement is AchievementInsert => achievement !== null);

      for (const achievement of toCreate) {
        await createAchievement(supabase, user.id, achievement);
        createdAchievements += 1;
      }
    }

    if (selections.applyWorkHistory) {
      const selectedIndexes = new Set(
        selections.selectedWorkHistoryIndexes ?? work_history.map((_, index) => index)
      );
      const existing = await listWorkHistory(supabase, user.id);
      const existingKeys = new Set(
        existing.map(
          (entry) => `${entry.job_title}|${entry.company}|${entry.start_date}`
        )
      );

      for (let index = 0; index < work_history.length; index += 1) {
        if (!selectedIndexes.has(index)) {
          continue;
        }
        const role = work_history[index];
        const normalized = normalizeWorkHistory(role);
        if (!normalized) {
          continue;
        }
        const key = `${normalized.job_title}|${normalized.company}|${normalized.start_date}`;
        if (existingKeys.has(key)) {
          continue;
        }
        await createWorkHistory(supabase, user.id, normalized);
        existingKeys.add(key);
        createdWorkHistory += 1;
      }

      if (createdWorkHistory > 0) {
        await insertAuditLog(supabase, {
          user_id: user.id,
          action: "cv.import.work_history",
          meta: { createdWorkHistory },
        });
      }
    }

    await insertAuditLog(supabase, {
      user_id: user.id,
      action: "cv.import.apply",
      meta: {
        updatedProfile,
        createdAchievements,
        createdWorkHistory,
      },
    });

    return NextResponse.json({
      updatedProfile,
      createdAchievements,
      createdWorkHistory,
    });
  } catch (error) {
    console.error("[cv.import.apply]", error);
    return NextResponse.json(
      {
        error: "Unable to apply the import right now.",
        detail: String((error as Error)?.message ?? error),
      },
      { status: 500 }
    );
  }
}

type AchievementInsert = {
  title: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  metrics: string;
};

function normalizeAchievement(
  input: z.infer<typeof achievementSchema>
): AchievementInsert | null {
  const title = input.title.trim();
  const action = input.action.trim();

  if (title.length < 3 || action.length < 20) {
    return null;
  }

  return {
    title,
    situation: normalizeNullable(input.situation),
    task: normalizeNullable(input.task),
    action,
    result: normalizeNullable(input.result),
    metrics: normalizeMetrics(input.metrics),
  };
}

function normalizeNullable(value?: string) {
  if (!value) {
    return "";
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : "";
}

function normalizeMetrics(value?: string) {
  if (!value) {
    return "";
  }
  const trimmed = value.trim();
  if (trimmed.length <= 120) {
    return trimmed;
  }
  return `${trimmed.slice(0, 117).replace(/[.;:,]+$/g, "").trim()}...`;
}

type WorkHistoryInsert = {
  job_title: string;
  company: string;
  location: string;
  start_date: string;
  end_date: string | null;
  is_current: boolean;
  summary: string;
  bullets: string[];
};

type WorkHistoryInput = NonNullable<
  z.infer<typeof applySchema>["work_history"]
>[number];

function normalizeWorkHistory(input: WorkHistoryInput): WorkHistoryInsert | null {
  const jobTitle = input.job_title.trim();
  const company = input.company.trim();
  const startDate = normalizeDate(input.start_date);
  if (!jobTitle || !company || !startDate) {
    return null;
  }

  const isCurrent = Boolean(input.is_current);
  const endDate = isCurrent ? null : normalizeDate(input.end_date);
  if (!isCurrent && input.end_date && !endDate) {
    return null;
  }

  const bullets = (input.bullets ?? [])
    .map((bullet) => bullet.trim())
    .filter(Boolean)
    .slice(0, 6)
    .map((bullet) =>
      bullet.length > 200 ? `${bullet.slice(0, 197).trimEnd()}...` : bullet
    );

  return {
    job_title: jobTitle,
    company,
    location: normalizeNullable(input.location),
    start_date: startDate,
    end_date: endDate,
    is_current: isCurrent,
    summary: normalizeNullable(input.summary),
    bullets,
  };
}

function normalizeDate(value?: string) {
  if (!value) {
    return "";
  }
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  if (/^\d{4}-\d{2}$/.test(trimmed)) {
    return `${trimmed}-01`;
  }
  return "";
}
