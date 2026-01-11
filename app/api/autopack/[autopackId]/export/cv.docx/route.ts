import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { fetchAutopack } from "@/lib/data/autopacks";
import { fetchProfile } from "@/lib/data/profile";
import { buildCvDocx, packDoc } from "@/lib/export/docx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: { autopackId: string } }
) {
  try {
    const supabase = createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const autopack = await fetchAutopack(
      supabase,
      user.id,
      params.autopackId
    );

    if (!autopack) {
      return NextResponse.json(
        { error: "Autopack not found." },
        { status: 404 }
      );
    }

    if (!autopack.cv_text) {
      return NextResponse.json(
        { error: "No CV content available." },
        { status: 400 }
      );
    }

    const profile = await fetchProfile(supabase, user.id);
    const doc = buildCvDocx(profile, autopack.cv_text);
    const buffer = await packDoc(doc);
    const filename = `cvforge-cv-${autopack.id.slice(0, 8)}.docx`;

    return new Response(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": buffer.byteLength.toString(),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[docx export cv]", error);
    return NextResponse.json(
      {
        error: "DOCX export failed",
        detail: String(
          error instanceof Error ? error.message : error ?? "Unknown error"
        ),
      },
      { status: 500 }
    );
  }
}
