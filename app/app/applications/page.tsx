import Link from "next/link";
import Section from "@/components/Section";
import { listApplications } from "@/lib/data/applications";
import { getSupabaseUser } from "@/lib/data/supabase";
import ApplicationsCommandCentre from "./applications-command-centre";
import { buildCommandCentreItems } from "@/lib/applications-command-centre";

export default async function ApplicationsPage() {
  const { supabase, user } = await getSupabaseUser();

  if (!user) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        Your session expired. Please sign in again.
      </div>
    );
  }

  const applications = await listApplications(supabase, user.id);
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

  return (
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
          <p>Create your first application to start the command centre.</p>
          <ol className="list-decimal space-y-1 pl-4 text-xs">
            <li>Create application with job link/text.</li>
            <li>Add evidence and STAR draft.</li>
            <li>Generate Autopack and submit.</li>
          </ol>
          <Link
            href="/app/applications/new"
            className="inline-flex w-fit rounded-full border border-black/10 bg-[rgb(var(--ink))] px-4 py-2 text-xs font-semibold text-white hover:bg-black"
          >
            Create application
          </Link>
        </div>
      ) : (
        <ApplicationsCommandCentre items={items} />
      )}
    </Section>
  );
}
