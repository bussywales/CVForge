import Link from "next/link";
import Section from "@/components/Section";
import { fetchApplication } from "@/lib/data/applications";
import { listAchievements } from "@/lib/data/achievements";
import { listWorkHistory } from "@/lib/data/work-history";
import { getSupabaseUser } from "@/lib/data/supabase";
import { fetchStarLibraryByGap } from "@/lib/data/star-library";
import { scoreEvidenceQuality } from "@/lib/evidence";
import StarLibraryEditor from "@/app/app/applications/star-library-editor";

type StarLibraryPageProps = {
  params: { id: string; gapKey: string };
};

type EvidenceSummary = {
  id: string;
  title: string;
  kind: "achievement" | "work_history";
  qualityScore: number;
};

export default async function StarLibraryPage({ params }: StarLibraryPageProps) {
  const { supabase, user } = await getSupabaseUser();

  if (!user) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        Your session expired. Please sign in again.
      </div>
    );
  }

  const gapKey = decodeURIComponent(params.gapKey);
  const application = await fetchApplication(supabase, user.id, params.id);

  if (!application) {
    return (
      <div className="space-y-4">
        <Link
          href="/app/applications"
          className="text-sm text-[rgb(var(--muted))]"
        >
          ← Back to applications
        </Link>
        <div className="rounded-3xl border border-black/10 bg-white/80 p-6 text-sm text-[rgb(var(--muted))]">
          This application was not found or you do not have access.
        </div>
      </div>
    );
  }

  const draft = await fetchStarLibraryByGap(
    supabase,
    user.id,
    application.id,
    gapKey
  );

  if (!draft) {
    return (
      <div className="space-y-4">
        <Link
          href={`/app/applications/${application.id}`}
          className="text-sm text-[rgb(var(--muted))]"
        >
          ← Back to application
        </Link>
        <div className="rounded-3xl border border-black/10 bg-white/80 p-6 text-sm text-[rgb(var(--muted))]">
          This STAR draft was not found yet. Create it from the STAR Library on
          the application page.
        </div>
      </div>
    );
  }

  const evidenceIds = Array.isArray(draft.evidence_ids)
    ? draft.evidence_ids
    : [];

  let evidence: EvidenceSummary[] = [];

  if (evidenceIds.length) {
    try {
      const [achievements, workHistory] = await Promise.all([
        listAchievements(supabase, user.id),
        listWorkHistory(supabase, user.id),
      ]);
      const achievementMatches = achievements
        .filter((item) => evidenceIds.includes(item.id))
        .map((item) => ({
          id: item.id,
          title: item.title,
          kind: "achievement" as const,
          qualityScore: scoreEvidenceQuality(
            [
              item.title,
              item.action,
              item.result,
              item.metrics,
            ]
              .filter(Boolean)
              .join(" ")
          ).score,
        }));
      const workMatches = workHistory
        .filter((item) => evidenceIds.includes(item.id))
        .map((item) => ({
          id: item.id,
          title: `${item.job_title} @ ${item.company}`,
          kind: "work_history" as const,
          qualityScore: scoreEvidenceQuality(
            [item.summary, ...(item.bullets ?? [])]
              .filter(Boolean)
              .join(" ")
          ).score,
        }));
      evidence = [...achievementMatches, ...workMatches];
    } catch (error) {
      console.error("[star-library.evidence]", error);
    }
  }

  return (
    <div className="space-y-6">
      <Link
        href={`/app/applications/${application.id}`}
        className="text-sm text-[rgb(var(--muted))]"
      >
        ← Back to application
      </Link>

      <Section
        title={`STAR draft · ${draft.title}`}
        description="Edit the draft and keep it ready for practice."
      >
        <StarLibraryEditor draft={draft} evidence={evidence} />
      </Section>
    </div>
  );
}
