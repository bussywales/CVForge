import { NextResponse } from "next/server";
import { z } from "zod";
import { createAchievement } from "@/lib/data/achievements";
import { getSupabaseUser } from "@/lib/data/supabase";
import { getFieldErrors } from "@/lib/validators/utils";

export const runtime = "nodejs";

const createAchievementDraftSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Title must be at least 3 characters.")
    .max(120, "Title must be 120 characters or fewer."),
  action: z
    .string()
    .trim()
    .min(20, "Action must be at least 20 characters.")
    .max(1000, "Action must be 1000 characters or fewer."),
  metrics: z
    .string()
    .trim()
    .max(120, "Metrics must be 120 characters or fewer.")
    .optional(),
});

export async function POST(request: Request) {
  const { supabase, user } = await getSupabaseUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createAchievementDraftSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Fix the highlighted fields to continue.",
        fieldErrors: getFieldErrors(parsed.error),
      },
      { status: 400 }
    );
  }

  try {
    const record = await createAchievement(supabase, user.id, {
      title: parsed.data.title,
      situation: "",
      task: "",
      action: parsed.data.action,
      result: "",
      metrics: parsed.data.metrics ?? "",
    });

    return NextResponse.json({ id: record.id });
  } catch (error) {
    console.error("[createAchievementDraft]", error);
    return NextResponse.json(
      { error: "Unable to add the achievement right now." },
      { status: 500 }
    );
  }
}
