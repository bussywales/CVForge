import Link from "next/link";
import Section from "@/components/Section";
import { fetchAutopack } from "@/lib/data/autopacks";
import { fetchApplication } from "@/lib/data/applications";
import { getSupabaseUser } from "@/lib/data/supabase";
import { hasPlaceholderTokens } from "@/lib/utils/autopack-sanitize";
import AutopackEditorForm from "@/app/app/applications/autopack-editor-form";
import AutopackGeneratedBanner from "@/app/app/applications/autopack-generated-banner";
import AutopackExportButtons from "@/app/app/applications/autopack-export-buttons";
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
  const hasPlaceholders = hasPlaceholderTokens(combinedText);
  const hasExperienceSection = /(^|\n)\s*(experience|employment)\b/i.test(
    cvText
  );
  const hasSkillsSection = /(^|\n)\s*(skills|key skills)\b/i.test(cvText);
  const companyName = application?.company?.trim() ?? "";
  const roleName = application?.job_title?.trim() ?? "";
  const coverLower = coverLetter.toLowerCase();
  const hasCompany = companyName
    ? coverLower.includes(companyName.toLowerCase())
    : false;
  const hasRole = roleName
    ? coverLower.includes(roleName.toLowerCase())
    : false;
  const hasGenericCover = /as advertised|your company|your organisation|your organization|the role|the position/i.test(
    coverLower
  );
  const coverPersonalised = coverLetter
    ? companyName
      ? hasCompany
      : hasRole || !hasGenericCover
    : false;
  const checklistItems = [
    {
      label: "No placeholders detected",
      ok: !hasPlaceholders,
      hint: hasPlaceholders
        ? "Remove bracketed placeholders or TODO notes before export."
        : undefined,
    },
    {
      label: "CV includes Experience section",
      ok: hasExperienceSection,
      hint: hasExperienceSection
        ? undefined
        : "Add an Experience or Employment heading.",
    },
    {
      label: "CV includes Skills section",
      ok: hasSkillsSection,
      hint: hasSkillsSection ? undefined : "Add a Skills section heading.",
    },
    {
      label: "Cover letter personalised",
      ok: coverPersonalised,
      hint: coverPersonalised
        ? undefined
        : "Reference the company or role explicitly.",
    },
  ];

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
          <SubmissionChecklist items={checklistItems} />
          <AutopackExportButtons autopackId={autopack.id} />
          <AutopackEditorForm autopack={autopack} />
        </div>
      </Section>
    </div>
  );
}
