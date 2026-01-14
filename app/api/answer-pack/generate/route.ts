import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import { fetchApplication } from "@/lib/data/applications";
import { listStarLibrary } from "@/lib/data/star-library";
import { insertAuditLog } from "@/lib/data/audit-log";
import {
  buildAnswer,
  inferQuestionType,
  selectStarDraft,
  type AnswerPackQuestionType,
  type AnswerPackVariant,
} from "@/lib/interview/answer-pack";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const questionTypeSchema = z.enum([
  "tell_me_about_yourself",
  "why_this_role",
  "why_us",
  "strengths",
  "weaknesses",
  "conflict",
  "pressure",
  "stakeholder_management",
  "technical_incident",
  "project_delivery",
  "leadership",
  "change_management",
  "security_risk",
  "general_star",
]);

const variantSchema = z.enum(["standard", "short90"]);

const payloadSchema = z.object({
  applicationId: z.string().uuid(),
  questionKey: z.string().min(3),
  questionType: questionTypeSchema.optional(),
  questionText: z.string().min(5).optional(),
  signals: z.array(z.string()).optional(),
  variant: variantSchema,
  starGapKey: z.string().optional(),
});

export async function POST(request: Request) {
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
    const application = await fetchApplication(
      supabase,
      user.id,
      parsed.data.applicationId
    );

    if (!application) {
      return NextResponse.json(
        { error: "Application not found." },
        { status: 404 }
      );
    }

    const drafts = await listStarLibrary(
      supabase,
      user.id,
      application.id
    );

    if (!drafts.length) {
      return NextResponse.json(
        { error: "Create a STAR draft first." },
        { status: 400 }
      );
    }

    const chosen = selectStarDraft(drafts, parsed.data.starGapKey);
    if (!chosen) {
      return NextResponse.json(
        { error: "No STAR draft available for this application." },
        { status: 400 }
      );
    }

    const questionType: AnswerPackQuestionType =
      parsed.data.questionType ??
      inferQuestionType(
        parsed.data.questionText ?? "",
        parsed.data.signals ?? []
      );

    const variant: AnswerPackVariant = parsed.data.variant;
    const short90 = variant === "short90";
    const { answerText, used } = buildAnswer({
      type: questionType,
      starDraft: chosen,
      short90,
    });

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("interview_answer_pack")
      .upsert(
        {
          user_id: user.id,
          application_id: application.id,
          question_id: null,
          question_key: parsed.data.questionKey,
          question_type: questionType,
          variant,
          star_gap_key: used.gapKey,
          star_library_id: used.starLibraryId,
          answer_text: answerText,
          updated_at: now,
        },
        {
          onConflict: "user_id,application_id,question_key,variant",
        }
      )
      .select(
        "question_key, question_type, variant, star_gap_key, star_library_id, answer_text"
      )
      .single();

    if (error || !data) {
      console.error("[answer-pack.upsert]", error);
      return NextResponse.json(
        { error: "Unable to generate answer pack." },
        { status: 500 }
      );
    }

    try {
      await insertAuditLog(supabase, {
        user_id: user.id,
        action: "answer_pack.generate",
        meta: {
          applicationId: application.id,
          questionKey: parsed.data.questionKey,
          variant,
          questionType,
          starGapKey: used.gapKey,
        },
      });
    } catch (auditError) {
      console.error("[answer-pack.audit]", auditError);
    }

    return NextResponse.json({
      answerText: data.answer_text,
      starLibraryId: data.star_library_id,
      starGapKey: data.star_gap_key,
      starTitle: chosen.title,
      variant: data.variant,
      questionType: data.question_type,
    });
  } catch (error) {
    console.error("[answer-pack.generate]", error);
    return NextResponse.json(
      { error: "Unable to generate answer pack." },
      { status: 500 }
    );
  }
}
