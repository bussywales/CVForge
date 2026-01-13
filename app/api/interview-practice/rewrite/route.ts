import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import { insertAuditLog } from "@/lib/data/audit-log";
import { scoreStarAnswer } from "@/lib/interview-practice";
import { rewriteStarAnswer } from "@/lib/interview-rewrite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const payloadSchema = z.object({
  applicationId: z.string().uuid(),
  questionKey: z.string().min(3).max(160),
  questionText: z.string().min(5).max(400),
  answerText: z.string().max(5000),
  rubric_json: z.unknown().optional(),
  meta: z
    .object({
      signals: z.array(z.string()).optional(),
      gaps: z.array(z.string()).optional(),
    })
    .optional(),
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
  const parsed = payloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const answerText = parsed.data.answerText.trim();
  if (!answerText) {
    return NextResponse.json(
      { error: "Add an answer before rewriting." },
      { status: 400 }
    );
  }

  try {
    const scoring = scoreStarAnswer({
      answerText,
      questionText: parsed.data.questionText,
      signals: parsed.data.meta?.signals ?? [],
      gaps: parsed.data.meta?.gaps ?? [],
    });

    const rewrite = rewriteStarAnswer({
      answerText,
      questionText: parsed.data.questionText,
      scoreBreakdown: scoring.breakdown,
      recommendations: scoring.recommendations,
      flags: scoring.flags,
      meta: parsed.data.meta,
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
      improved_text: rewrite.improvedText,
      improved_meta: rewrite.notes,
      improved_updated_at: now,
      updated_at: now,
    };

    const { data, error } = await supabase
      .from("interview_practice_answers")
      .upsert(payload, {
        onConflict: "user_id,application_id,question_key",
      })
      .select(
        "id, question_key, question_text, answer_text, rubric_json, score, improved_text, improved_meta, improved_updated_at, updated_at, created_at"
      )
      .single();

    if (error || !data) {
      console.error("[interview-practice.rewrite.upsert]", error);
      return NextResponse.json(
        { error: "Unable to save rewrite right now." },
        { status: 500 }
      );
    }

    try {
      await insertAuditLog(supabase, {
        user_id: user.id,
        action: "interview.practice.rewrite",
        meta: {
          applicationId: parsed.data.applicationId,
          questionKey: parsed.data.questionKey,
          score: scoring.totalScore,
        },
      });
    } catch (auditError) {
      console.error("[interview-practice.rewrite.audit]", auditError);
    }

    return NextResponse.json({
      answer: data,
      scoring,
      improvedText: rewrite.improvedText,
      notes: rewrite.notes,
    });
  } catch (error) {
    console.error("[interview-practice.rewrite]", error);
    return NextResponse.json(
      {
        error: "Unable to rewrite answer right now.",
        detail: String(
          error instanceof Error ? error.message : error ?? "Unknown error"
        ),
      },
      { status: 500 }
    );
  }
}
