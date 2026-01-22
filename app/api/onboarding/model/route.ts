import { NextResponse } from "next/server";
import { withRequestIdHeaders, jsonError, applyRequestIdHeaders } from "@/lib/observability/request-id";
import { getSupabaseUser } from "@/lib/data/supabase";
import { checkRateLimit } from "@/lib/rate-limit";
import { getRateLimitBudget } from "@/lib/rate-limit-budgets";
import { getOnboardingModel } from "@/lib/onboarding/onboarding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { headers, requestId } = withRequestIdHeaders(request.headers, undefined, { noStore: true });
  const { user, supabase } = await getSupabaseUser();
  if (!user) {
    return jsonError({ code: "UNAUTHORIZED", message: "Unauthorized", requestId, status: 401 });
  }

  const budget = getRateLimitBudget("onboarding_model_get");
  const limiter = checkRateLimit({ route: "onboarding_model_get", identifier: user.id, limit: budget.limit, windowMs: budget.windowMs, category: "user_action" });
  if (!limiter.allowed) {
    const res = jsonError({
      code: "RATE_LIMITED",
      message: "Rate limited — try again shortly",
      requestId,
      status: 429,
      meta: { limitKey: "onboarding_model_get", budget: budget.budget, retryAfterSeconds: limiter.retryAfterSeconds },
    });
    return applyRequestIdHeaders(res, requestId, { noStore: true, retryAfterSeconds: limiter.retryAfterSeconds });
  }

  try {
    const model = await getOnboardingModel({ userId: user.id, supabase, now: new Date() });
    return NextResponse.json({ ok: true, model, requestId }, { headers });
  } catch {
    return jsonError({ code: "ONBOARDING_MODEL_FAILED", message: "Unable to load onboarding", requestId, status: 500 });
  }
}
