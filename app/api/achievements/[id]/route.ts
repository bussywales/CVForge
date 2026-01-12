import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const appendClauseSchema = z.object({
  clause: z
    .string()
    .trim()
    .min(3, "Clause must be at least 3 characters.")
    .max(120, "Clause must be 120 characters or fewer."),
});

export async function PATCH(
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

  const body = await request.json().catch(() => null);
  const parsed = appendClauseSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload." },
      { status: 400 }
    );
  }

  const clause = normaliseClause(parsed.data.clause);
  if (!clause) {
    return NextResponse.json(
      { error: "Nothing to insert for this achievement." },
      { status: 400 }
    );
  }

  const { data: existing, error: fetchError } = await supabase
    .from("achievements")
    .select("action")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (fetchError) {
    console.error("[appendAchievementClause.fetch]", fetchError);
    return NextResponse.json(
      { error: "Unable to update the achievement right now." },
      { status: 500 }
    );
  }

  if (!existing) {
    return NextResponse.json(
      { error: "Achievement not found." },
      { status: 404 }
    );
  }

  const currentAction = (existing.action ?? "").trim();
  if (currentAction.toLowerCase().includes(clause.toLowerCase())) {
    return NextResponse.json({ id: params.id, updated: false });
  }

  const updatedAction = currentAction
    ? `${currentAction.replace(/[;\s]+$/g, "")}; ${clause}`
    : clause;

  const { error: updateError } = await supabase
    .from("achievements")
    .update({ action: updatedAction })
    .eq("id", params.id)
    .eq("user_id", user.id);

  if (updateError) {
    console.error("[appendAchievementClause.update]", updateError);
    return NextResponse.json(
      { error: "Unable to update the achievement right now." },
      { status: 500 }
    );
  }

  return NextResponse.json({ id: params.id, updated: true });
}

function normaliseClause(value: string) {
  const trimmed = value.trim().replace(/[.;:,]+$/g, "");
  if (!trimmed) {
    return "";
  }
  if (trimmed.length <= 120) {
    return trimmed;
  }
  return trimmed.slice(0, 120).replace(/[.;:,]+$/g, "").trim();
}
