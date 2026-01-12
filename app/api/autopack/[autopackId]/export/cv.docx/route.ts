import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { fetchAutopack } from "@/lib/data/autopacks";
import { fetchApplication } from "@/lib/data/applications";
import { fetchProfile } from "@/lib/data/profile";
import { buildCvDocx, packDoc } from "@/lib/export/docx";
import { sanitizeTextContent } from "@/lib/utils/autopack-sanitize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sanitizeFilenamePart(value: string) {
  return value
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

function buildFilename(
  name: string,
  role: string | null,
  typeLabel: string
) {
  const safeName = sanitizeFilenamePart(name) || "User";
  const safeRole = role ? sanitizeFilenamePart(role) : "";
  const parts = ["CVForge", safeName];

  if (safeRole) {
    parts.push(safeRole);
  }

  parts.push(typeLabel);
  return `${parts.join(" - ")}.docx`;
}

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
    const application = await fetchApplication(
      supabase,
      user.id,
      autopack.application_id
    );
    const sanitizedCvText = sanitizeTextContent(autopack.cv_text);
    const fallbackName =
      profile?.full_name?.trim() ||
      user.email?.split("@")[0] ||
      "User";
    const filename = buildFilename(
      fallbackName,
      application?.job_title ?? null,
      "CV"
    );

    const doc = buildCvDocx(profile, sanitizedCvText, {
      email: user.email ?? null,
    });
    const buffer = await packDoc(doc);

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
