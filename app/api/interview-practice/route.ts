import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import { insertAuditLog } from "@/lib/data/audit-log";
import { scoreStarAnswer } from "@/lib/interview-practice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const payloadSchema = z.object({
  applicationId: z.string().uuid(),
  questionKey: z.string().min(3).max(160),
  questionText: z.string().min(5).max(400),
  answerText: z.string().max(5000),
  meta: z
    .object({
      signals: z.array(z.string()).optional(),
      gaps: z.array(z.string()).optional(),
    })
    .optional(),
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
  const applicationId = searchParams.get("applicationId");

  if (!applicationId) {
    return NextResponse.json(
      { error: "Missing applicationId." },
      { status: 400 }
    );
  }

  try {
    const { data, error } = await supabase
      .from("interview_practice_answers")
      .select(
        "id, question_key, question_text, answer_text, rubric_json, score, updated_at, created_at"
      )
      .eq("user_id", user.id)
      .eq("application_id", applicationId)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("[interview-practice.list]", error);
      return NextResponse.json(
        { error: "Unable to load practice answers." },
        { status: 500 }
      );
    }

    return NextResponse.json({ answers: data ?? [] });
  } catch (error) {
    console.error("[interview-practice.list]", error);
    return NextResponse.json(
      { error: "Unable to load practice answers." },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  try {
    const answerText = parsed.data.answerText.trim();
    const scoring = scoreStarAnswer({
      answerText,
      questionText: parsed.data.questionText,
      signals: parsed.data.meta?.signals ?? [],
      gaps: parsed.data.meta?.gaps ?? [],
    });

    const now = new Date().toISOString();
    const payload = {
      user_id: user.id,
      application_id: parsed.data.applicationId,
      question_key: parsed.data.questionKey,
      question_text: parsed.data.questionText,
      answer_text: answerText,
      rubric_json: {
        totalScore: scoring.totalScore,
        breakdown: scoring.breakdown,
        flags: scoring.flags,
        recommendations: scoring.recommendations,
        signals: parsed.data.meta?.signals ?? [],
        gaps: parsed.data.meta?.gaps ?? [],
      },
      score: scoring.totalScore,
      updated_at: now,
    };

    const { data, error } = await supabase
      .from("interview_practice_answers")
      .upsert(payload, {
        onConflict: "user_id,application_id,question_key",
      })
      .select(
        "id, question_key, question_text, answer_text, rubric_json, score, updated_at, created_at"
      )
      .single();

    if (error || !data) {
      console.error("[interview-practice.upsert]", error);
      return NextResponse.json(
        { error: "Unable to save practice answer." },
        { status: 500 }
      );
    }

    try {
      await insertAuditLog(supabase, {
        user_id: user.id,
        action: "interview.practice.scored",
        meta: {
          applicationId: parsed.data.applicationId,
          questionKey: parsed.data.questionKey,
          score: scoring.totalScore,
        },
      });
    } catch (auditError) {
      console.error("[interview-practice.audit]", auditError);
    }

    return NextResponse.json({ answer: data, scoring });
  } catch (error) {
    console.error("[interview-practice.save]", error);
    return NextResponse.json(
      {
        error: "Unable to save practice answer.",
        detail: String(
          error instanceof Error ? error.message : error ?? "Unknown error"
        ),
      },
      { status: 500 }
    );
  }
}
