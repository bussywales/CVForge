import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { ensureReferralCode } from "@/lib/referrals";
import { withRequestIdHeaders, jsonError } from "@/lib/observability/request-id";
import { captureServerError } from "@/lib/observability/sentry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { headers, requestId } = withRequestIdHeaders();
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonError({ code: "UNAUTHORIZED", message: "Unauthorized", requestId, status: 401 });
  }

  try {
    const codeRow = await ensureReferralCode(supabase, user.id);
    if (!codeRow) {
      return jsonError({ code: "REFERRAL_CODE_FAIL", message: "Unable to generate code", requestId });
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const inviteUrl = `${siteUrl.replace(/\/$/, "")}/login?ref=${codeRow.code}`;

    return NextResponse.json({ code: codeRow.code, inviteUrl }, { headers });
  } catch (error) {
    captureServerError(error, { requestId, route: "/api/referrals/me", userId: user.id, code: "REFERRAL_CODE_FAIL" });
    return jsonError({ code: "REFERRAL_CODE_FAIL", message: "Unable to generate code", requestId });
  }
}
