import { NextResponse } from "next/server";
import * as mammoth from "mammoth";
import { insertAuditLog } from "@/lib/data/audit-log";
import { createServerClient } from "@/lib/supabase/server";
import { extractCvPreview } from "@/lib/cv-import";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

export async function POST(request: Request) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || typeof file !== "object" || !("arrayBuffer" in file)) {
      return NextResponse.json(
        { error: "Please upload a DOCX file." },
        { status: 400 }
      );
    }

    const uploadedFile = file as File;
    const fileName = uploadedFile.name ?? "";
    const fileType = uploadedFile.type ?? "";
    const fileSize = uploadedFile.size ?? 0;

    if (fileSize > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File is too large. Max size is 5MB." },
        { status: 400 }
      );
    }

    const isDocxName = fileName.toLowerCase().endsWith(".docx");
    const isDocxType =
      fileType ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      fileType === "application/octet-stream" ||
      fileType === "";

    if (!isDocxName || !isDocxType) {
      return NextResponse.json(
        { error: "Only .docx files are supported." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await uploadedFile.arrayBuffer());
    const result = await mammoth.extractRawText({ buffer });
    const rawText = result?.value ?? "";

    if (!rawText.trim()) {
      return NextResponse.json(
        { error: "Unable to extract text from this DOCX file." },
        { status: 422 }
      );
    }

    const preview = extractCvPreview(rawText);

    await insertAuditLog(supabase, {
      user_id: user.id,
      action: "cv.import.preview",
      meta: {
        achievementsCount: preview.achievements.length,
        sectionsDetected: preview.extracted.sectionsDetected,
        warningsCount: preview.extracted.warnings.length,
      },
    });

    return NextResponse.json(preview);
  } catch (error) {
    console.error("[cv.import.preview]", error);
    return NextResponse.json(
      {
        error: "DOCX import failed.",
        detail: String((error as Error)?.message ?? error),
      },
      { status: 500 }
    );
  }
}
