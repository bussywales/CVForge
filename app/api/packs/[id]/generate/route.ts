import { NextResponse } from "next/server";
import { applyRequestIdHeaders, jsonError, withRequestIdHeaders } from "@/lib/observability/request-id";
import { getSupabaseUser } from "@/lib/data/supabase";
import { getEarlyAccessDecision } from "@/lib/early-access";
import { checkRateLimit } from "@/lib/rate-limit";
import { getRateLimitBudget } from "@/lib/rate-limit-budgets";
import { generatePackOutputs } from "@/lib/packs/packs-generate";
import { createPackVersion, fetchApplicationPack, updatePackStatus } from "@/lib/packs/packs-store";
import { coercePackOutputs } from "@/lib/packs/packs-model";
import { logMonetisationEvent } from "@/lib/monetisation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const JD_MAX = 20000;
const CV_MAX = 20000;
const NOTES_MAX = 6000;

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { headers, requestId } = withRequestIdHeaders(request.headers, undefined, { noStore: true });
  const { supabase, user } = await getSupabaseUser();
  if (!user) return jsonError({ code: "UNAUTHORIZED", message: "Unauthorized", requestId, status: 401 });

  const access = await getEarlyAccessDecision({ userId: user.id, email: user.email });
  if (!access.allowed) {
    return jsonError({ code: "EARLY_ACCESS_REQUIRED", message: "Early access required", requestId, status: 403 });
  }

  const budget = getRateLimitBudget("packs_generate");
  const limiter = checkRateLimit({
    route: "packs_generate",
    identifier: user.id,
    limit: budget.limit,
    windowMs: budget.windowMs,
    category: "monetisation",
  });
  if (!limiter.allowed) {
    const res = jsonError({
      code: "RATE_LIMITED",
      message: "Rate limited — try again shortly",
      requestId,
      status: 429,
      meta: { limitKey: "packs_generate", budget: budget.budget, retryAfterSeconds: limiter.retryAfterSeconds },
    });
    return applyRequestIdHeaders(res, requestId, { noStore: true, retryAfterSeconds: limiter.retryAfterSeconds });
  }

  let body: any = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonError({ code: "BAD_JSON", message: "Invalid JSON body", requestId, status: 400 });
  }

  const jobDescription = typeof body.jobDescription === "string" ? body.jobDescription.trim().slice(0, JD_MAX) : "";
  const cvText = typeof body.cvText === "string" ? body.cvText.trim().slice(0, CV_MAX) : null;
  const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, NOTES_MAX) : null;
  const mode = body.mode === "ats" ? "ats" : "standard";

  if (!jobDescription) {
    return jsonError({ code: "BAD_INPUT", message: "Job description is required", requestId, status: 400 });
  }

  const pack = await fetchApplicationPack({ supabase, userId: user.id, packId: params.id });
  if (!pack) {
    return jsonError({ code: "NOT_FOUND", message: "Pack not found", requestId, status: 404 });
  }

  try {
    await updatePackStatus({ supabase, userId: user.id, packId: params.id, status: "in_progress" });
  } catch {
    // best-effort status update
  }

  try {
    const { outputs, modelMeta } = await generatePackOutputs({
      jobDescription,
      cvText,
      notes,
      mode,
    });

    const inputsMasked = {
      jdLength: jobDescription.length,
      cvLength: cvText?.length ?? 0,
      notesLength: notes?.length ?? 0,
      hasCv: Boolean(cvText),
      hasNotes: Boolean(notes),
      mode,
    };

    const version = await createPackVersion({
      supabase,
      userId: user.id,
      packId: params.id,
      jobDescription,
      inputsMasked,
      outputs,
      modelMeta,
    });

    await updatePackStatus({ supabase, userId: user.id, packId: params.id, status: "ready" });

    try {
      await logMonetisationEvent(supabase, user.id, "pack_generated", {
        surface: "packs",
        meta: {
          packId: params.id,
          versionId: version.id,
          jdLength: jobDescription.length,
          cvLength: cvText?.length ?? 0,
          notesLength: notes?.length ?? 0,
          mode,
        },
      });
    } catch {
      // ignore logging failures
    }

    return NextResponse.json(
      {
        ok: true,
        requestId,
        pack: { ...pack, status: "ready" },
        version: { ...version, outputs: coercePackOutputs(version.outputs) },
      },
      { headers }
    );
  } catch (error) {
    try {
      await updatePackStatus({ supabase, userId: user.id, packId: params.id, status: "draft" });
    } catch {
      // ignore
    }
    try {
      await logMonetisationEvent(supabase, user.id, "pack_generation_failed", {
        surface: "packs",
        meta: {
          packId: params.id,
          jdLength: jobDescription.length,
          cvLength: cvText?.length ?? 0,
          notesLength: notes?.length ?? 0,
          mode,
        },
      });
    } catch {
      // ignore logging failures
    }
    return jsonError({ code: "PACK_GENERATE_FAIL", message: "Unable to generate pack", requestId });
  }
}
