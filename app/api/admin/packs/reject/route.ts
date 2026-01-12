import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseUser } from "@/lib/data/supabase";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { isAdminEmail } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const payloadSchema = z.object({
  proposalId: z.string().uuid(),
});

export async function POST(request: Request) {
  const { user } = await getSupabaseUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  try {
    const service = createServiceRoleClient();
    const now = new Date().toISOString();

    const { error } = await service
      .from("domain_pack_proposals")
      .update({ status: "rejected", updated_at: now })
      .eq("id", parsed.data.proposalId)
      .eq("status", "pending");

    if (error) {
      console.error("[admin.reject]", error);
      return NextResponse.json(
        { error: "Unable to reject the proposal." },
        { status: 500 }
      );
    }

    return NextResponse.json({ status: "rejected" });
  } catch (error) {
    console.error("[admin.reject]", error);
    return NextResponse.json(
      { error: "Unable to reject the proposal." },
      { status: 500 }
    );
  }
}
