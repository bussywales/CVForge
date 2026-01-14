import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { fetchAutopack } from "@/lib/data/autopacks";
import { fetchApplication } from "@/lib/data/applications";
import { fetchProfile } from "@/lib/data/profile";
import { buildCoverLetterDocx, packDoc } from "@/lib/export/docx";
import { buildExportFilename } from "@/lib/export/filename";
import { resolveExportVariant, sanitizeForExport } from "@/lib/export/export-utils";
import { markApplyChecklist } from "@/lib/apply-checklist";

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

    if (!autopack.cover_letter) {
      return NextResponse.json(
        { error: "No cover letter content available." },
        { status: 400 }
      );
    }

    const profile = await fetchProfile(supabase, user.id);
    const application = await fetchApplication(
      supabase,
      user.id,
      autopack.application_id
    );
    const variant = resolveExportVariant(
      new URL(request.url).searchParams.get("variant")
    );
    const sanitizedCoverLetter = sanitizeForExport(autopack.cover_letter);
    const sanitizedCvText = autopack.cv_text
      ? sanitizeForExport(autopack.cv_text)
      : "";
    const fallbackName =
      profile?.full_name?.trim() ||
      user.email?.split("@")[0] ||
      "CVForge";
    const filename = buildExportFilename(
      fallbackName,
      application?.job_title ?? null,
      "Cover-Letter",
      "docx"
    );

    const doc = buildCoverLetterDocx(profile, sanitizedCoverLetter, {
      email: user.email ?? null,
      contactText: sanitizedCvText,
      variant,
      recipientName: application?.contact_name ?? null,
      companyName: application?.company_name ?? application?.company ?? null,
    });
    const buffer = await packDoc(doc);
    const now = new Date().toISOString();

    try {
      await markApplyChecklist(supabase, user.id, autopack.application_id, {
        cover_exported_at: now,
      });
    } catch (checklistError) {
      console.error("[docx export cover-letter checklist]", checklistError);
    }

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
    console.error("[docx export cover-letter]", error);
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
