import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import { fetchApplication, updateApplication } from "@/lib/data/applications";
import { listAchievements } from "@/lib/data/achievements";
import { listAutopacks } from "@/lib/data/autopacks";
import { buildStarDraft } from "@/lib/star-draft";
import { getEffectiveJobText } from "@/lib/job-text";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const payloadSchema = z.object({
  achievementId: z.string().uuid().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = payloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  try {
    const application = await fetchApplication(supabase, user.id, params.id);
    if (!application) {
      return NextResponse.json(
        { error: "Application not found." },
        { status: 404 }
      );
    }

    const achievements = await listAchievements(supabase, user.id);
    if (!achievements.length) {
      return NextResponse.json(
        { error: "Add an achievement before drafting a STAR answer." },
        { status: 400 }
      );
    }

    const selected = parsed.data.achievementId
      ? achievements.find((item) => item.id === parsed.data.achievementId)
      : achievements[0];

    if (!selected) {
      return NextResponse.json(
        { error: "Selected achievement not found." },
        { status: 404 }
      );
    }

    const draft = buildStarDraft({
      jobDescription: getEffectiveJobText(application),
      achievementTitle: selected.title,
    });

    const autopacks = await listAutopacks(supabase, user.id, application.id);
    const now = new Date().toISOString();

    if (autopacks.length > 0) {
      const latest = autopacks[0];
      const existing = Array.isArray(latest.answers_json)
        ? latest.answers_json
        : [];
      const updated = [...existing, draft];

      const { error } = await supabase
        .from("autopacks")
        .update({ answers_json: updated })
        .eq("id", latest.id)
        .eq("user_id", user.id);

      if (error) {
        console.error("[star-draft.autopack]", error);
        return NextResponse.json(
          { error: "Unable to update autopack answers." },
          { status: 500 }
        );
      }
    } else {
      const currentDrafts = Array.isArray(application.star_drafts)
        ? application.star_drafts
        : [];
      const updated = [...currentDrafts, draft];

      await updateApplication(supabase, user.id, application.id, {
        star_drafts: updated,
      });
    }

    await updateApplication(supabase, user.id, application.id, {
      last_lift_action: "draft_star",
      lift_completed_at: now,
    });

    return NextResponse.json({ ok: true, draft });
  } catch (error) {
    console.error("[star-draft]", error);
    return NextResponse.json(
      { error: "Unable to create STAR draft." },
      { status: 500 }
    );
  }
}
