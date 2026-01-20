import { NextResponse } from "next/server";
import { withRequestIdHeaders, jsonError } from "@/lib/observability/request-id";
import { getSupabaseUser } from "@/lib/data/supabase";
import { getUserRole, isOpsRole } from "@/lib/rbac";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { captureServerError } from "@/lib/observability/sentry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPPORTED_RANGES = new Set(["7d", "24h"]);
const EVENT_TYPES = [
  "activation_view",
  "activation_step_click",
  "activation_primary_cta_click",
  "activation_cta_click",
  "activation_completed",
  "activation_model_error",
  "activation_skip_week",
  "activation_funnel_view",
  "activation_funnel_export",
  "activation_first_application",
  "activation_first_outreach",
  "activation_first_followup",
  "activation_first_outcome",
  "keep_momentum_view",
  "keep_momentum_cta_click",
  "keep_momentum_secondary_click",
  "keep_momentum_skip_week",
  "keep_momentum_model_error",
];

type Counts = {
  activation_view: number;
  activation_step_click: number;
  activation_primary_cta_click: number;
  activation_cta_click: number;
  activation_completed: number;
  activation_model_error: Record<string, number>;
  activation_skip_week: number;
  activation_funnel_view: number;
  activation_funnel_export: number;
  keep_momentum_view: number;
  keep_momentum_cta_click: number;
  keep_momentum_secondary_click: number;
  keep_momentum_skip_week: number;
  keep_momentum_model_error: number;
};

type Milestones = {
  first_application: number;
  first_outreach: number;
  first_followup: number;
  first_outcome: number;
};

function parseBody(body: unknown): Record<string, any> {
  if (!body) return {};
  if (typeof body === "object") return body as Record<string, any>;
  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }
  return {};
}

export async function GET(request: Request) {
  const { headers, requestId } = withRequestIdHeaders(request.headers);
  try {
    const { user } = await getSupabaseUser();
    if (!user) {
      return jsonError({ code: "UNAUTHORIZED", message: "Unauthorized", requestId, status: 401 });
    }
    const role = await getUserRole(user.id);
    if (!isOpsRole(role.role)) {
      return jsonError({ code: "FORBIDDEN", message: "Forbidden", requestId, status: 403 });
    }

    const url = new URL(request.url);
    const rangeParam = url.searchParams.get("range") ?? "7d";
    if (!SUPPORTED_RANGES.has(rangeParam)) {
      return jsonError({ code: "BAD_INPUT", message: "Invalid range", requestId, status: 400 });
    }

    const hours = rangeParam === "24h" ? 24 : 24 * 7;
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    const admin = createServiceRoleClient();
    const { data, error } = await admin
      .from("application_activities")
      .select("type, body, occurred_at")
      .gte("occurred_at", since)
      .in(
        "type",
        EVENT_TYPES.map((e) => `monetisation.${e}`)
      );

    if (error) {
      throw error;
    }

  const counts: Counts = {
    activation_view: 0,
    activation_step_click: 0,
    activation_primary_cta_click: 0,
    activation_cta_click: 0,
    activation_completed: 0,
    activation_model_error: {},
    activation_skip_week: 0,
    activation_funnel_view: 0,
    activation_funnel_export: 0,
    keep_momentum_view: 0,
    keep_momentum_cta_click: 0,
    keep_momentum_secondary_click: 0,
    keep_momentum_skip_week: 0,
    keep_momentum_model_error: 0,
  };
    const stepClicks: Record<string, number> = {};
    const ctaClicks: Record<string, number> = {};
  const milestones: Milestones = {
    first_application: 0,
    first_outreach: 0,
    first_followup: 0,
    first_outcome: 0,
  };
  const ruleCounts: Record<string, number> = {};

    (data ?? []).forEach((row: any) => {
      const event = (row?.type ?? "").toString().replace("monetisation.", "");
      if (!EVENT_TYPES.includes(event)) return;
      const meta = parseBody(row?.body);
      switch (event) {
        case "activation_view":
          counts.activation_view += 1;
          break;
        case "activation_step_click":
          counts.activation_step_click += 1;
          if (meta?.stepId) {
            stepClicks[meta.stepId] = (stepClicks[meta.stepId] ?? 0) + 1;
          }
          break;
        case "activation_primary_cta_click":
          counts.activation_primary_cta_click += 1;
          break;
        case "activation_cta_click":
          counts.activation_cta_click += 1;
          if (meta?.ctaId) {
            ctaClicks[meta.ctaId] = (ctaClicks[meta.ctaId] ?? 0) + 1;
          }
          break;
        case "activation_completed":
          counts.activation_completed += 1;
          break;
        case "activation_model_error": {
          const code = meta?.code ?? "unknown";
          counts.activation_model_error[code] = (counts.activation_model_error[code] ?? 0) + 1;
          break;
        }
        case "activation_skip_week":
          counts.activation_skip_week += 1;
          break;
        case "activation_funnel_view":
          counts.activation_funnel_view += 1;
          break;
        case "activation_funnel_export":
          counts.activation_funnel_export += 1;
          break;
        case "keep_momentum_view":
          counts.keep_momentum_view += 1;
          if (meta?.ruleId) ruleCounts[meta.ruleId] = (ruleCounts[meta.ruleId] ?? 0) + 1;
          break;
        case "keep_momentum_cta_click":
          counts.keep_momentum_cta_click += 1;
          if (meta?.ruleId) ruleCounts[meta.ruleId] = (ruleCounts[meta.ruleId] ?? 0) + 1;
          break;
        case "keep_momentum_secondary_click":
          counts.keep_momentum_secondary_click += 1;
          if (meta?.ruleId) ruleCounts[meta.ruleId] = (ruleCounts[meta.ruleId] ?? 0) + 1;
          break;
        case "keep_momentum_skip_week":
          counts.keep_momentum_skip_week += 1;
          if (meta?.ruleId) ruleCounts[meta.ruleId] = (ruleCounts[meta.ruleId] ?? 0) + 1;
          break;
        case "keep_momentum_model_error":
          counts.keep_momentum_model_error += 1;
          break;
        case "activation_first_application":
          milestones.first_application += 1;
          break;
        case "activation_first_outreach":
          milestones.first_outreach += 1;
          break;
        case "activation_first_followup":
          milestones.first_followup += 1;
          break;
        case "activation_first_outcome":
          milestones.first_outcome += 1;
          break;
        default:
          break;
      }
    });

    return NextResponse.json(
      {
        ok: true,
        range: rangeParam,
        counts,
        stepClicks,
        ctaClicks,
        milestones,
        rules: Object.entries(ruleCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([ruleId, count]) => ({ ruleId, count })),
      },
      { headers }
    );
  } catch (error) {
    captureServerError(error, { requestId, route: "/api/ops/activation-funnel" });
    return jsonError({
      code: "SERVER_ERROR",
      message: "Unable to load activation funnel.",
      requestId,
      status: 500,
    });
  }
}
