import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const updateSchema = z
  .object({
    clause: z
      .string()
      .trim()
      .min(3, "Clause must be at least 3 characters.")
      .max(120, "Clause must be 120 characters or fewer.")
      .optional(),
    metrics: z.string().trim().max(120).optional(),
  })
  .refine((value) => Boolean(value.clause || value.metrics), {
    message: "Invalid payload.",
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
  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload." },
      { status: 400 }
    );
  }

  const clause = parsed.data.clause ? normaliseClause(parsed.data.clause) : "";
  const metrics = parsed.data.metrics?.trim() ?? "";

  const { data: existing, error: fetchError } = await supabase
    .from("achievements")
    .select("action, metrics")
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

  let updatePayload: { action?: string; metrics?: string } = {};

  if (clause) {
    const currentAction = (existing.action ?? "").trim();
    if (currentAction.toLowerCase().includes(clause.toLowerCase())) {
      return NextResponse.json({ id: params.id, updated: false });
    }
    updatePayload.action = currentAction
      ? `${currentAction.replace(/[;\s]+$/g, "")}; ${clause}`
      : clause;
  }

  if (metrics) {
    const currentMetrics = (existing.metrics ?? "").trim();
    if (!currentMetrics) {
      updatePayload.metrics = metrics;
    } else if (!currentMetrics.toLowerCase().includes(metrics.toLowerCase())) {
      const combined = `${currentMetrics} / ${metrics}`.trim();
      updatePayload.metrics = combined.length <= 120 ? combined : metrics;
    }
  }

  if (!Object.keys(updatePayload).length) {
    return NextResponse.json({ id: params.id, updated: false });
  }

  const { error: updateError } = await supabase
    .from("achievements")
    .update(updatePayload)
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
