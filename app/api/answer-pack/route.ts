import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  applicationId: z.string().uuid(),
  questionKey: z.string().min(3),
});

export async function GET(request: Request) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({
    applicationId: searchParams.get("applicationId"),
    questionKey: searchParams.get("questionKey"),
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  try {
    const { data, error } = await supabase
      .from("interview_answer_pack")
      .select(
        "id, question_key, question_type, variant, star_gap_key, star_library_id, answer_text, updated_at"
      )
      .eq("user_id", user.id)
      .eq("application_id", parsed.data.applicationId)
      .eq("question_key", parsed.data.questionKey);

    if (error) {
      console.error("[answer-pack.list]", error);
      return NextResponse.json(
        { error: "Unable to load answer pack." },
        { status: 500 }
      );
    }

    const rows = data ?? [];
    const starIds = Array.from(
      new Set(rows.map((row) => row.star_library_id).filter(Boolean))
    );
    let starTitleMap = new Map<string, { title: string; gapKey: string }>();

    if (starIds.length) {
      const { data: stars, error: starError } = await supabase
        .from("star_library")
        .select("id, title, gap_key")
        .eq("user_id", user.id)
        .in("id", starIds);
      if (starError) {
        console.error("[answer-pack.stars]", starError);
      } else {
        starTitleMap = new Map(
          (stars ?? []).map((star) => [
            star.id,
            { title: star.title, gapKey: star.gap_key },
          ])
        );
      }
    }

    const response = {
      standard: null as null | Record<string, unknown>,
      short90: null as null | Record<string, unknown>,
    };

    rows.forEach((row) => {
      const starMeta = starTitleMap.get(row.star_library_id);
      const payload = {
        answerText: row.answer_text,
        variant: row.variant,
        questionType: row.question_type,
        starLibraryId: row.star_library_id,
        starGapKey: row.star_gap_key,
        starTitle: starMeta?.title ?? null,
      };
      if (row.variant === "short90") {
        response.short90 = payload;
      } else {
        response.standard = payload;
      }
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error("[answer-pack.list]", error);
    return NextResponse.json(
      { error: "Unable to load answer pack." },
      { status: 500 }
    );
  }
}
