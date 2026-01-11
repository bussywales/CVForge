import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { autopackUpdateSchema } from "@/lib/validators/autopack";
import { getFieldErrors } from "@/lib/validators/utils";

const ANSWERS_JSON_MAX = 25000;

export async function PATCH(
  request: Request,
  { params }: { params: { autopackId: string } }
) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = autopackUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid payload",
        fieldErrors: getFieldErrors(parsed.error),
      },
      { status: 400 }
    );
  }

  let answersJson: unknown = parsed.data.answers_json;

  if (typeof answersJson === "string") {
    try {
      answersJson = JSON.parse(answersJson);
    } catch (error) {
      return NextResponse.json(
        { error: "answers_json must be valid JSON." },
        { status: 400 }
      );
    }
  }

  const answersSize = JSON.stringify(answersJson).length;
  if (answersSize > ANSWERS_JSON_MAX) {
    return NextResponse.json(
      { error: "answers_json is too large." },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("autopacks")
    .update({
      cv_text: parsed.data.cv_text,
      cover_letter: parsed.data.cover_letter,
      answers_json: answersJson,
    })
    .eq("id", params.autopackId)
    .eq("user_id", user.id)
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: "Autopack not found." },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true });
}
