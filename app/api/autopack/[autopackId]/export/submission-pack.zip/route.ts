import { NextResponse } from "next/server";
import archiver from "archiver";
import { PassThrough, Readable } from "stream";
import { createServerClient } from "@/lib/supabase/server";
import { fetchAutopack } from "@/lib/data/autopacks";
import { fetchApplication } from "@/lib/data/applications";
import { fetchProfile } from "@/lib/data/profile";
import { buildCvDocx, buildCoverLetterDocx, packDoc } from "@/lib/export/docx";
import { resolveExportVariant, sanitizeForExport } from "@/lib/export/export-utils";
import { buildSubmissionPackFiles } from "@/lib/export/submission-pack";

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

    if (!autopack.cv_text || !autopack.cover_letter) {
      return NextResponse.json(
        { error: "CV and cover letter are required for a submission pack." },
        { status: 400 }
      );
    }

    const variant = resolveExportVariant(
      new URL(request.url).searchParams.get("variant")
    );

    const profile = await fetchProfile(supabase, user.id);
    const application = await fetchApplication(
      supabase,
      user.id,
      autopack.application_id
    );

    const sanitizedCvText = sanitizeForExport(autopack.cv_text);
    const sanitizedCoverLetter = sanitizeForExport(autopack.cover_letter);

    const cvDoc = buildCvDocx(profile, sanitizedCvText, {
      email: user.email ?? null,
      variant,
    });
    const coverDoc = buildCoverLetterDocx(profile, sanitizedCoverLetter, {
      email: user.email ?? null,
      contactText: sanitizedCvText,
      variant,
      recipientName: application?.contact_name ?? null,
      companyName: application?.company_name ?? application?.company ?? null,
    });

    const [cvBuffer, coverBuffer] = await Promise.all([
      packDoc(cvDoc),
      packDoc(coverDoc),
    ]);

    const fallbackName =
      profile?.full_name?.trim() ||
      user.email?.split("@")[0] ||
      "CVForge";

    const pack = buildSubmissionPackFiles({
      name: fallbackName,
      role: application?.job_title ?? null,
      cvBuffer,
      coverBuffer,
      autopackAnswers: autopack.answers_json,
      starDrafts: application?.star_drafts ?? [],
    });

    const archive = archiver("zip", { zlib: { level: 9 } });
    const stream = new PassThrough();

    archive.on("error", (error) => {
      console.error("[submission-pack]", error);
      stream.destroy(error as Error);
    });

    archive.pipe(stream);
    pack.entries.forEach((entry) => {
      archive.append(entry.content, { name: entry.name });
    });
    void archive.finalize();

    return new Response(Readable.toWeb(stream) as unknown as ReadableStream, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${pack.zipFilename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[submission-pack]", error);
    return NextResponse.json(
      {
        error: "Submission pack export failed",
        detail: String(
          error instanceof Error ? error.message : error ?? "Unknown error"
        ),
      },
      { status: 500 }
    );
  }
}
