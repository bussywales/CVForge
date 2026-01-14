import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import { fetchApplication } from "@/lib/data/applications";
import { insertAuditLog } from "@/lib/data/audit-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const payloadSchema = z.object({
  applicationId: z.string().uuid(),
  questionKey: z.string().min(3),
  questionText: z.string().min(5).optional(),
  variant: z.enum(["standard", "short90"]),
});

export async function PATCH(request: Request) {
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

    const { data: answerPack, error: packError } = await supabase
      .from("interview_answer_pack")
      .select("answer_text, question_type, variant")
      .eq("user_id", user.id)
      .eq("application_id", application.id)
      .eq("question_key", parsed.data.questionKey)
      .eq("variant", parsed.data.variant)
      .maybeSingle();

    if (packError || !answerPack) {
      return NextResponse.json(
        { error: "Answer pack not found." },
        { status: 404 }
      );
    }

    const { data: existing, error: existingError } = await supabase
      .from("interview_practice_answers")
      .select("id, question_text")
      .eq("user_id", user.id)
      .eq("application_id", application.id)
      .eq("question_key", parsed.data.questionKey)
      .maybeSingle();

    if (existingError) {
      console.error("[answer-pack.apply.lookup]", existingError);
    }

    const questionText =
      parsed.data.questionText ??
      existing?.question_text ??
      parsed.data.questionKey;
    const now = new Date().toISOString();

    if (existing?.id) {
      const { error } = await supabase
        .from("interview_practice_answers")
        .update({
          answer_text: answerPack.answer_text,
          question_text: questionText,
          updated_at: now,
        })
        .eq("id", existing.id)
        .eq("user_id", user.id);

      if (error) {
        console.error("[answer-pack.apply.update]", error);
        return NextResponse.json(
          { error: "Unable to apply answer pack." },
          { status: 500 }
        );
      }
    } else {
      const { error } = await supabase
        .from("interview_practice_answers")
        .insert({
          user_id: user.id,
          application_id: application.id,
          question_key: parsed.data.questionKey,
          question_text: questionText,
          answer_text: answerPack.answer_text,
          rubric_json: {},
          score: 0,
          updated_at: now,
        });

      if (error) {
        console.error("[answer-pack.apply.insert]", error);
        return NextResponse.json(
          { error: "Unable to apply answer pack." },
          { status: 500 }
        );
      }
    }

    try {
      await insertAuditLog(supabase, {
        user_id: user.id,
        action: "answer_pack.apply",
        meta: {
          applicationId: application.id,
          questionKey: parsed.data.questionKey,
          variant: parsed.data.variant,
          questionType: answerPack.question_type,
        },
      });
    } catch (auditError) {
      console.error("[answer-pack.audit]", auditError);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[answer-pack.apply]", error);
    return NextResponse.json(
      { error: "Unable to apply answer pack." },
      { status: 500 }
    );
  }
}
