import Link from "next/link";
import Section from "@/components/Section";
import { listApplications } from "@/lib/data/applications";
import { getSupabaseUser } from "@/lib/data/supabase";
import ApplicationsCommandCentre from "./applications-command-centre";
import { buildCommandCentreItems } from "@/lib/applications-command-centre";
import { getUserCredits } from "@/lib/data/credits";
import CreditsIdleNudge from "@/components/CreditsIdleNudge";
import { buildFollowupItems } from "@/lib/outreach-autopilot";
import FollowupsDueStrip from "@/components/followups-due-strip";
import { computeOutreachInsight } from "@/lib/outreach-insights";
import EarlyAccessBlock from "@/components/EarlyAccessBlock";
import { getEarlyAccessDecision } from "@/lib/early-access";

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[]>;
}) {
  const { supabase, user } = await getSupabaseUser();

  if (!user) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        Your session expired. Please sign in again.
      </div>
    );
  }

  const access = await getEarlyAccessDecision({ userId: user.id, email: user.email });
  if (!access.allowed) {
    return <EarlyAccessBlock email={user.email} reason={access.source} />;
  }

  const applications = await listApplications(supabase, user.id);
  const credits = await getUserCredits(supabase, user.id);
  let outreachInsight: ReturnType<typeof computeOutreachInsight> | null = null;
  const [evidenceRows, starRows, autopackRows] = await Promise.all([
    supabase
      .from("application_evidence")
      .select("application_id")
      .eq("user_id", user.id),
    supabase
      .from("star_library")
      .select("application_id")
      .eq("user_id", user.id),
    supabase
      .from("autopacks")
      .select("application_id")
      .eq("user_id", user.id),
  ]);

  if (evidenceRows.error) {
    console.error("[applications.evidenceCounts]", evidenceRows.error);
  }
  if (starRows.error) {
    console.error("[applications.starCounts]", starRows.error);
  }
  if (autopackRows.error) {
    console.error("[applications.autopackCounts]", autopackRows.error);
  }

  try {
    const since = new Date();
    since.setDate(since.getDate() - 14);
    const { data, error } = await supabase
      .from("application_activities")
      .select("type,occurred_at")
      .eq("user_id", user.id)
      .gte("occurred_at", since.toISOString());
    if (!error && data) {
      outreachInsight = computeOutreachInsight(data);
    }
  } catch (error) {
    console.error("[applications.outreachInsight]", error);
  }

  const evidenceCounts = (evidenceRows.data ?? []).reduce<Record<string, number>>(
    (acc, row: any) => {
      const id = row.application_id;
      if (!id) return acc;
      acc[id] = (acc[id] ?? 0) + 1;
      return acc;
    },
    {}
  );

  const starCounts = (starRows.data ?? []).reduce<Record<string, number>>(
    (acc, row: any) => {
      const id = row.application_id;
      if (!id) return acc;
      acc[id] = (acc[id] ?? 0) + 1;
      return acc;
    },
    {}
  );

  const autopackCounts = (autopackRows.data ?? []).reduce<Record<string, number>>(
    (acc, row: any) => {
      const id = row.application_id;
      if (!id) return acc;
      acc[id] = (acc[id] ?? 0) + 1;
      return acc;
    },
    {}
  );

  const items = buildCommandCentreItems(applications, {
    evidence: evidenceCounts,
    star: starCounts,
    autopack: autopackCounts,
  });
  const followupsDue = buildFollowupItems(applications as any);
  const paidItem =
    credits > 0
      ? items.find((item) =>
          /apply-autopacks|interview-pack|application-kit|answer-pack|practice\/drill/.test(
            item.nextActionHref
          )
        )
      : null;

  return (
    <>
      {paidItem ? (
        <div className="mb-4">
          <CreditsIdleNudge
            applicationId={paidItem.id}
            href={paidItem.nextActionHref}
            surface="applications"
          />
        </div>
      ) : null}
      {followupsDue.length ? (
        <div className="mb-4">
          <FollowupsDueStrip items={followupsDue} surface="applications" />
        </div>
      ) : null}
      <Section
        title="Applications"
        description="Your next actions across roles."
        action={
          <Link
            href="/app/applications/new"
            className="rounded-2xl bg-[rgb(var(--accent))] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[rgb(var(--accent-strong))]"
          >
            New application
          </Link>
        }
      >
        {items.length === 0 ? (
          <div className="space-y-3 rounded-2xl border border-dashed border-black/20 bg-white/70 p-6 text-sm text-[rgb(var(--muted))]">
            <p>Start with one application to unlock next steps.</p>
            <Link
              href="/app/applications/new"
              className="inline-flex w-fit rounded-full border border-black/10 bg-[rgb(var(--ink))] px-4 py-2 text-xs font-semibold text-white hover:bg-black"
            >
              Create your first application
            </Link>
          </div>
        ) : (
          <ApplicationsCommandCentre
            items={items}
            outreachInsight={outreachInsight}
            initialView={searchParams?.view === "outreach" ? "outreach" : "queue"}
          />
        )}
      </Section>
    </>
  );
}
