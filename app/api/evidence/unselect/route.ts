import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import { fetchApplication, updateApplication } from "@/lib/data/applications";
import {
  normalizeSelectedEvidence,
  type SelectedEvidenceEntry,
} from "@/lib/evidence";
import { removeApplicationEvidence } from "@/lib/data/application-evidence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const payloadSchema = z.object({
  applicationId: z.string().uuid(),
  gapKey: z.string().min(2),
  evidenceId: z.string().min(3),
});

export async function POST(request: Request) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = payloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  try {
    const application = await fetchApplication(
      supabase,
      user.id,
      parsed.data.applicationId
    );

    if (!application) {
      return NextResponse.json(
        { error: "Application not found." },
        { status: 404 }
      );
    }

    await removeApplicationEvidence(
      supabase,
      user.id,
      application.id,
      parsed.data.gapKey,
      parsed.data.evidenceId
    );

    const existing = normalizeSelectedEvidence(application.selected_evidence);
    const updated = existing.filter(
      (entry) =>
        !(
          entry.id === parsed.data.evidenceId &&
          entry.signalId === parsed.data.gapKey
        )
    ) as SelectedEvidenceEntry[];

    await updateApplication(supabase, user.id, application.id, {
      selected_evidence: updated,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[evidence.unselect]", error);
    return NextResponse.json(
      { error: "Unable to unselect evidence right now." },
      { status: 500 }
    );
  }
}
