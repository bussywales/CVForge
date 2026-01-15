import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import { redeemReferral } from "@/lib/referrals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ code: z.string().min(4) });

export async function POST(request: Request) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }

  // Find inviter by code
  const { data: codeRow } = await supabase
    .from("referral_codes")
    .select("user_id")
    .eq("code", parsed.data.code)
    .maybeSingle();

  if (!codeRow?.user_id || codeRow.user_id === user.id) {
    return NextResponse.json({ error: "Invalid or self referral" }, { status: 400 });
  }

  const result = await redeemReferral(
    supabase,
    codeRow.user_id,
    user.id,
    parsed.data.code
  );

  return NextResponse.json({ ok: true, ...result });
}
