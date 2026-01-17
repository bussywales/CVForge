import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import { fetchApplication } from "@/lib/data/applications";
import { listStarLibrary, upsertStarLibrary } from "@/lib/data/star-library";
import { normalizeSelectedEvidence } from "@/lib/evidence";
import { createApplicationActivity } from "@/lib/data/application-activities";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  applicationId: z.string().uuid(),
});

export async function GET(request: Request) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect("/login");
  }

  const parsed = querySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams)
  );
  if (!parsed.success) {
    return NextResponse.redirect("/app/insights?coach=missing_app");
  }

  let application;
  let existingDrafts;
  try {
    application = await fetchApplication(
      supabase,
      user.id,
      parsed.data.applicationId
    );
    if (!application) {
      return NextResponse.redirect("/app/insights?coach=missing_app");
    }
    existingDrafts = await listStarLibrary(
      supabase,
      user.id,
      application.id
    );
  } catch (error) {
    console.error("[coach.star.fetch]", error);
    return NextResponse.redirect("/app/insights?coach=error");
  }

  const selectedEvidence = normalizeSelectedEvidence(
    application.selected_evidence
  );
  const gapLabel =
    selectedEvidence[0]?.signalId.replace("_", " ") ||
    application.job_title ||
    "Priority gap";

  if (existingDrafts.length === 0) {
    try {
      await upsertStarLibrary(supabase, user.id, {
        application_id: application.id,
        gap_key: selectedEvidence[0]?.signalId ?? "priority_gap",
        signal_key: selectedEvidence[0]?.signalId ?? null,
        title: `STAR for ${gapLabel}`,
        situation:
          "Briefly set the context for the project or challenge (scope, team, timeline).",
        task: "Clarify your responsibility or the objective.",
        action:
          "List 2-3 concrete actions you took. Include tools/processes and ownership verbs.",
        result:
          "Share the outcome with metrics (time saved, uptime, cost, risk).",
        evidence_ids: selectedEvidence.length ? [selectedEvidence[0].id] : [],
        quality_hint: "Medium",
        updated_at: new Date().toISOString(),
      });

      await createApplicationActivity(supabase, user.id, {
        application_id: application.id,
        type: "coach.star.created",
        channel: null,
        subject: "STAR draft created",
        body: `Coach created STAR for ${gapLabel}`,
        occurred_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error("[coach.star.create]", error);
      return NextResponse.redirect(
        `/app/insights?coach=error&applicationId=${application.id}`
      );
    }
  }

  return NextResponse.redirect(
    `/app/applications/${application.id}?tab=evidence#star-library&coach=star_created`
  );
}
