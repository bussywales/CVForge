import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { fetchAutopack } from "@/lib/data/autopacks";
import { fetchProfile } from "@/lib/data/profile";
import { buildCoverLetterDocx, packDoc } from "@/lib/export/docx";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: { autopackId: string } }
) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const autopack = await fetchAutopack(supabase, user.id, params.autopackId);

  if (!autopack) {
    return NextResponse.json({ error: "Autopack not found." }, { status: 404 });
  }

  if (!autopack.cover_letter) {
    return NextResponse.json(
      { error: "No cover letter content available." },
      { status: 400 }
    );
  }

  const profile = await fetchProfile(supabase, user.id);
  const doc = buildCoverLetterDocx(
    profile,
    autopack.cover_letter,
    user.email ?? null
  );
  const buffer = await packDoc(doc);
  const filename = `cvforge-cover-letter-${autopack.id.slice(0, 8)}.docx`;

  return new Response(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
