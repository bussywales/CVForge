import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import { redeemReferral } from "@/lib/referrals";
import { withRequestIdHeaders, jsonError } from "@/lib/observability/request-id";
import { captureServerError } from "@/lib/observability/sentry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ code: z.string().min(4) });

export async function POST(request: Request) {
  const { headers, requestId } = withRequestIdHeaders(request.headers);
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return jsonError({ code: "UNAUTHORIZED", message: "Unauthorized", requestId, status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return jsonError({ code: "INVALID_CODE", message: "Invalid code", requestId, status: 400 });
  }

  // Find inviter by code
  const { data: codeRow } = await supabase
    .from("referral_codes")
    .select("user_id")
    .eq("code", parsed.data.code)
    .maybeSingle();

  if (!codeRow?.user_id || codeRow.user_id === user.id) {
    return jsonError({ code: "INVALID_REFERRAL", message: "Invalid or self referral", requestId, status: 400 });
  }

  try {
    const result = await redeemReferral(
      supabase,
      codeRow.user_id,
      user.id,
      parsed.data.code
    );

    return NextResponse.json({ ok: true, ...result }, { headers });
  } catch (error) {
    captureServerError(error, { route: "/api/referrals/redeem", requestId, userId: user.id, code: "REFERRAL_REDEEM_FAIL" });
    return jsonError({ code: "REFERRAL_REDEEM_FAIL", message: "Unable to redeem referral", requestId });
  }
}
