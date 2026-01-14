import Link from "next/link";
import Section from "@/components/Section";
import { fetchAutopack } from "@/lib/data/autopacks";
import { fetchApplication } from "@/lib/data/applications";
import { listAchievements } from "@/lib/data/achievements";
import { fetchProfile } from "@/lib/data/profile";
import { getSupabaseUser } from "@/lib/data/supabase";
import { extractLinkedIn, extractPhone } from "@/lib/export/contact";
import {
  calculateKeywordCoverage,
  checkCoverConsistency,
  countMetricBullets,
  detectMissingSections,
  detectPlaceholders,
} from "@/lib/submission-quality";
import { getEffectiveJobText } from "@/lib/job-text";
import AutopackEditorForm from "@/app/app/applications/autopack-editor-form";
import AutopackGeneratedBanner from "@/app/app/applications/autopack-generated-banner";
import AutopackExportButtons from "@/app/app/applications/autopack-export-buttons";
import AutopackEvidenceUsed from "@/app/app/applications/autopack-evidence-used";
import SubmissionChecklist from "@/app/app/applications/submission-checklist";

type AutopackPageProps = {
  params: { id: string; autopackId: string };
  searchParams?: { generated?: string; remaining?: string; used?: string };
};

export default async function AutopackEditorPage({
  params,
  searchParams,
}: AutopackPageProps) {
  const { supabase, user } = await getSupabaseUser();

  if (!user) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        Your session expired. Please sign in again.
      </div>
    );
  }

  const autopack = await fetchAutopack(supabase, user.id, params.autopackId);

  if (!autopack || autopack.application_id !== params.id) {
    return (
      <div className="space-y-4">
        <Link
          href={`/app/applications/${params.id}`}
          className="text-sm text-[rgb(var(--muted))]"
        >
          ← Back to application
        </Link>
        <div className="rounded-3xl border border-black/10 bg-white/80 p-6 text-sm text-[rgb(var(--muted))]">
          This autopack was not found or you do not have access.
        </div>
      </div>
    );
  }

  const application = await fetchApplication(
    supabase,
    user.id,
    autopack.application_id
  );
  const profile = await fetchProfile(supabase, user.id);
  const achievements = await listAchievements(supabase, user.id);

  const showGenerated = Boolean(searchParams?.generated);
  const remainingCredits = searchParams?.remaining
    ? Number.parseInt(searchParams.remaining, 10)
    : null;
  const creditUsed = searchParams?.used !== "0";
  const remainingLabel =
    typeof remainingCredits === "number" && Number.isFinite(remainingCredits)
      ? `${remainingCredits} remaining`
      : "balance updating";
  const generatedMessage = creditUsed
    ? `Autopack generated — 1 credit used (${remainingLabel})`
    : `Autopack generated — credit bypass enabled (${remainingLabel})`;
  const clearPath = `/app/applications/${params.id}/autopacks/${params.autopackId}`;

  const cvText = autopack.cv_text ?? "";
  const coverLetter = autopack.cover_letter ?? "";
  const combinedText = [cvText, coverLetter].join("\n");
  const hasPlaceholders = detectPlaceholders(combinedText);
  const sections = detectMissingSections(cvText);
  const metricsCoverage = countMetricBullets(cvText);
  const companyName = application?.company?.trim() ?? "";
  const roleName = application?.job_title?.trim() ?? "";
  const coverConsistency = checkCoverConsistency(
    coverLetter,
    companyName,
    roleName
  );
  const evidence = [
    profile?.headline,
    ...achievements.map((achievement) =>
      [
        achievement.title,
        achievement.action,
        achievement.result,
        achievement.metrics,
      ]
        .filter(Boolean)
        .join(" ")
    ),
  ]
    .filter(Boolean)
    .join(" ");
  const keywordCoverage = calculateKeywordCoverage(
    application ? getEffectiveJobText(application) : "",
    evidence
  );
  const contactPhone = extractPhone(combinedText);
  const contactLinkedIn = extractLinkedIn(combinedText);
  const hasContactMethod = Boolean(
    user.email || contactPhone || contactLinkedIn
  );
  const contactComplete = Boolean(profile?.full_name?.trim() && hasContactMethod);
  const autopackAnswers = Array.isArray(autopack.answers_json)
    ? autopack.answers_json
    : [];
  const starDraftsSource = application?.star_drafts;
  const starDrafts = Array.isArray(starDraftsSource) ? starDraftsSource : [];
  const starAnswerCount =
    autopackAnswers.length > 0 ? autopackAnswers.length : starDrafts.length;

  return (
    <div className="space-y-6">
      <Link
        href={`/app/applications/${params.id}`}
        className="text-sm text-[rgb(var(--muted))]"
      >
        ← Back to application
      </Link>

      {showGenerated ? (
        <AutopackGeneratedBanner
          message={generatedMessage}
          clearPath={clearPath}
        />
      ) : null}

      <Section
        title={`Autopack v${autopack.version}`}
        description="Edit the CV, cover letter, and STAR answers."
      >
        <div className="space-y-4">
          <SubmissionChecklist
            keywordCoveragePct={keywordCoverage.coveragePct}
            keywordMatched={keywordCoverage.matchedCount}
            keywordTotal={keywordCoverage.totalCount}
            metricCount={metricsCoverage.metricCount}
            bulletCount={metricsCoverage.bulletCount}
            longBullets={metricsCoverage.longBullets}
            hasExperience={sections.hasExperience}
            hasSkills={sections.hasSkills}
            hasPlaceholders={hasPlaceholders}
            coverOk={coverConsistency.ok}
            coverHint={coverConsistency.hint}
          />
          <AutopackEvidenceUsed evidenceTrace={autopack.evidence_trace} />
          <AutopackExportButtons
            autopackId={autopack.id}
            hasPlaceholders={hasPlaceholders}
            contactComplete={contactComplete}
            starCount={starAnswerCount}
          />
          <AutopackEditorForm autopack={autopack} />
        </div>
      </Section>
    </div>
  );
}
