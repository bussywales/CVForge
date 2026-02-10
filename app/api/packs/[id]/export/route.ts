import { NextResponse } from "next/server";
import { applyRequestIdHeaders, jsonError, withRequestIdHeaders } from "@/lib/observability/request-id";
import { getSupabaseUser } from "@/lib/data/supabase";
import { getEarlyAccessDecision } from "@/lib/early-access";
import { checkRateLimit } from "@/lib/rate-limit";
import { getRateLimitBudget } from "@/lib/rate-limit-budgets";
import { fetchApplicationPack, updatePackStatus } from "@/lib/packs/packs-store";
import { buildPackDocx } from "@/lib/packs/packs-docx";
import { packDoc } from "@/lib/export/docx";
import { coercePackOutputs } from "@/lib/packs/packs-model";
import { buildExportFilename } from "@/lib/export/filename";
import { logMonetisationEvent } from "@/lib/monetisation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function hasMeaningfulOutputs(outputs: ReturnType<typeof coercePackOutputs>) {
  if (outputs.cv.summary.trim()) return true;
  if (outputs.cv.sections.some((s) => s.bullets.some((b) => b.trim()))) return true;
  if (outputs.coverLetter.trim()) return true;
  if (outputs.starStories.length > 0) return true;
  if (outputs.fitMap.length > 0) return true;
  if (outputs.rationale.trim()) return true;
  return false;
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { requestId } = withRequestIdHeaders(request.headers, undefined, { noStore: true });
  const { supabase, user } = await getSupabaseUser();
  if (!user) return jsonError({ code: "UNAUTHORIZED", message: "Unauthorized", requestId, status: 401 });

  const access = await getEarlyAccessDecision({ userId: user.id, email: user.email });
  if (!access.allowed) {
    return jsonError({ code: "EARLY_ACCESS_REQUIRED", message: "Early access required", requestId, status: 403 });
  }

  const budget = getRateLimitBudget("packs_export");
  const limiter = checkRateLimit({
    route: "packs_export",
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
      meta: { limitKey: "packs_export", budget: budget.budget, retryAfterSeconds: limiter.retryAfterSeconds },
    });
    return applyRequestIdHeaders(res, requestId, { noStore: true, retryAfterSeconds: limiter.retryAfterSeconds });
  }

  let body: any = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonError({ code: "BAD_JSON", message: "Invalid JSON body", requestId, status: 400 });
  }

  const versionId = typeof body.versionId === "string" ? body.versionId : "";
  const format = typeof body.format === "string" ? body.format : "docx";
  const variant = body.variant === "ats" ? "ats_minimal" : "standard";

  if (!versionId) {
    return jsonError({ code: "BAD_INPUT", message: "versionId is required", requestId, status: 400 });
  }
  if (format !== "docx") {
    return jsonError({ code: "BAD_INPUT", message: "Unsupported format", requestId, status: 400 });
  }

  try {
    const pack = await fetchApplicationPack({ supabase, userId: user.id, packId: params.id });
    if (!pack) {
      return jsonError({ code: "NOT_FOUND", message: "Pack not found", requestId, status: 404 });
    }

    const { data: versionRow, error: versionError } = await supabase
      .from("application_pack_versions")
      .select("id,pack_id,user_id,outputs,created_at")
      .eq("id", versionId)
      .eq("pack_id", params.id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (versionError) throw versionError;
    if (!versionRow) {
      return jsonError({ code: "NOT_FOUND", message: "Version not found", requestId, status: 404 });
    }

    const outputs = coercePackOutputs(versionRow.outputs);
    if (!hasMeaningfulOutputs(outputs)) {
      return jsonError({ code: "NO_OUTPUTS", message: "Nothing to export yet", requestId, status: 400 });
    }
    const doc = buildPackDocx({
      title: pack.title,
      outputs,
      variant,
    });
    const buffer = await packDoc(doc);
    const filename = buildExportFilename(pack.title, pack.roleTitle ?? null, "Submission-Pack", "docx");

    try {
      await updatePackStatus({ supabase, userId: user.id, packId: params.id, status: "exported" });
    } catch {
      // ignore
    }

    try {
      await logMonetisationEvent(supabase, user.id, "pack_exported", {
        surface: "packs",
        meta: {
          packId: params.id,
          versionId,
          variant: body.variant === "ats" ? "ats" : "standard",
        },
      });
    } catch {
      // ignore logging failures
    }

    const res = new Response(buffer, {
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "content-disposition": `attachment; filename=\"${filename}\"`,
        "content-length": buffer.byteLength.toString(),
      },
    });
    return applyRequestIdHeaders(res, requestId, { noStore: true });
  } catch {
    return jsonError({ code: "PACK_EXPORT_FAIL", message: "Unable to export pack", requestId });
  }
}
