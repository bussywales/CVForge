import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { ensureReferralCode } from "@/lib/referrals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const codeRow = await ensureReferralCode(supabase, user.id);
  if (!codeRow) {
    return NextResponse.json({ error: "Unable to generate code" }, { status: 500 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const inviteUrl = `${siteUrl.replace(/\/$/, "")}/auth/signup?ref=${codeRow.code}`;

  return NextResponse.json({ code: codeRow.code, inviteUrl });
}
