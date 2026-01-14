import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import { fetchApplication } from "@/lib/data/applications";
import { updateEvidenceTargets } from "@/lib/data/application-evidence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const payloadSchema = z.object({
  applicationId: z.string().uuid(),
  gapKey: z.string().min(2),
  evidenceId: z.string().min(3),
  useCv: z.boolean(),
  useCover: z.boolean(),
  useStar: z.boolean(),
});

export async function PATCH(request: Request) {
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

    const updated = await updateEvidenceTargets(
      supabase,
      user.id,
      application.id,
      parsed.data.gapKey,
      parsed.data.evidenceId,
      {
        use_cv: parsed.data.useCv,
        use_cover: parsed.data.useCover,
        use_star: parsed.data.useStar,
      }
    );

    return NextResponse.json({ ok: true, targets: updated });
  } catch (error) {
    console.error("[evidence.targets]", error);
    return NextResponse.json(
      { error: "Unable to update evidence targets right now." },
      { status: 500 }
    );
  }
}
