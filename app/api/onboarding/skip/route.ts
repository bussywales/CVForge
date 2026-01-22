import { NextResponse } from "next/server";
import { withRequestIdHeaders, jsonError, applyRequestIdHeaders } from "@/lib/observability/request-id";
import { getSupabaseUser } from "@/lib/data/supabase";
import { checkRateLimit } from "@/lib/rate-limit";
import { getRateLimitBudget } from "@/lib/rate-limit-budgets";
import { skipOnboarding } from "@/lib/onboarding/onboarding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { headers, requestId } = withRequestIdHeaders(request.headers, undefined, { noStore: true });
  const { user, supabase } = await getSupabaseUser();
  if (!user) {
    return jsonError({ code: "UNAUTHORIZED", message: "Unauthorized", requestId, status: 401 });
  }

  const budget = getRateLimitBudget("onboarding_skip_post");
  const limiter = checkRateLimit({ route: "onboarding_skip_post", identifier: user.id, limit: budget.limit, windowMs: budget.windowMs, category: "user_action" });
  if (!limiter.allowed) {
    const res = jsonError({
      code: "RATE_LIMITED",
      message: "Rate limited — try again shortly",
      requestId,
      status: 429,
      meta: { limitKey: "onboarding_skip_post", budget: budget.budget, retryAfterSeconds: limiter.retryAfterSeconds },
    });
    return applyRequestIdHeaders(res, requestId, { noStore: true, retryAfterSeconds: limiter.retryAfterSeconds });
  }

  const body = await request.json().catch(() => ({}));
  const untilRaw = typeof body?.until === "string" ? body.until : null;
  const now = new Date();
  const defaultUntil = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const until = untilRaw ? new Date(untilRaw) : defaultUntil;
  const maxUntil = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const cappedUntil = until.getTime() > maxUntil.getTime() ? maxUntil : until;

  try {
    await skipOnboarding({ userId: user.id, until: cappedUntil, supabase });
    return NextResponse.json({ ok: true, skipUntil: cappedUntil.toISOString(), requestId }, { headers });
  } catch {
    return jsonError({ code: "ONBOARDING_SKIP_FAILED", message: "Unable to skip onboarding", requestId, status: 500 });
  }
}
