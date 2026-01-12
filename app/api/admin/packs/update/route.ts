import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseUser } from "@/lib/data/supabase";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { isAdminEmail } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const signalSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  weight: z.number().min(1).max(10),
  aliasesText: z.string().optional(),
  gapSuggestions: z.array(z.string()).optional(),
  metricSnippets: z.array(z.string()).optional(),
});

const payloadSchema = z.object({
  proposalId: z.string().uuid(),
  title: z.string().min(2).max(120),
  signals: z.array(signalSchema),
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
    const signals = parsed.data.signals.map((signal) => ({
      id: signal.id,
      label: signal.label,
      weight: signal.weight,
      aliases: (signal.aliasesText ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
      gapSuggestions: signal.gapSuggestions ?? [],
      metricSnippets: signal.metricSnippets ?? [],
    }));

    const { error } = await service
      .from("domain_pack_proposals")
      .update({
        title: parsed.data.title.trim(),
        signals,
        updated_at: new Date().toISOString(),
      })
      .eq("id", parsed.data.proposalId)
      .eq("status", "pending");

    if (error) {
      console.error("[admin.update]", error);
      return NextResponse.json(
        { error: "Unable to update the proposal." },
        { status: 500 }
      );
    }

    return NextResponse.json({ status: "updated" });
  } catch (error) {
    console.error("[admin.update]", error);
    return NextResponse.json(
      { error: "Unable to update the proposal." },
      { status: 500 }
    );
  }
}
