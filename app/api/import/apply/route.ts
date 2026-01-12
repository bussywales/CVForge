import { NextResponse } from "next/server";
import { z } from "zod";
import { createAchievement } from "@/lib/data/achievements";
import { insertAuditLog } from "@/lib/data/audit-log";
import { ensureProfile } from "@/lib/data/profile";
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

  const { selections, profile, achievements = [] } = parsed.data;
  let updatedProfile = false;
  let createdAchievements = 0;

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

    await insertAuditLog(supabase, {
      user_id: user.id,
      action: "cv.import.apply",
      meta: {
        updatedProfile,
        createdAchievements,
      },
    });

    return NextResponse.json({
      updatedProfile,
      createdAchievements,
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
