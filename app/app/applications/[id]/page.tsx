import Link from "next/link";
import Section from "@/components/Section";
import { listAchievements } from "@/lib/data/achievements";
import { fetchApplication } from "@/lib/data/applications";
import { listAutopacks } from "@/lib/data/autopacks";
import { fetchProfile } from "@/lib/data/profile";
import { getSupabaseUser } from "@/lib/data/supabase";
import { calculateRoleFit } from "@/lib/role-fit";
import { deleteApplicationAction, updateApplicationAction } from "../actions";
import ApplicationForm from "../application-form";
import AutopacksSection from "../autopacks-section";
import DeleteApplicationForm from "../delete-application-form";
import JobAdvertCard from "../job-advert-card";
import RoleFitCard from "../role-fit-card";

type ApplicationPageProps = {
  params: { id: string };
  searchParams?: { created?: string };
};

export default async function ApplicationPage({
  params,
  searchParams,
}: ApplicationPageProps) {
  const { supabase, user } = await getSupabaseUser();

  if (!user) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        Your session expired. Please sign in again.
      </div>
    );
  }

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

  const autopacks = await listAutopacks(supabase, user.id, application.id);
  const profile = await fetchProfile(supabase, user.id);
  const achievements = await listAchievements(supabase, user.id);
  const jobDescription = application.job_description ?? "";
  const evidenceParts = [
    profile?.headline,
    ...achievements.map((achievement) =>
      [achievement.title, achievement.metrics].filter(Boolean).join(" ")
    ),
  ].filter(Boolean) as string[];
  const evidence = evidenceParts.join(" ").trim();
  const hasJobDescription = Boolean(jobDescription.trim());
  const hasEvidence = Boolean(evidence);
  const roleFit = calculateRoleFit(jobDescription, evidence);
  const jobUrl = application.job_url?.trim() ?? "";
  let safeJobUrl: string | null = null;
  let jobHost = "";

  if (jobUrl) {
    try {
      const parsed = new URL(jobUrl);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        safeJobUrl = parsed.toString();
        jobHost = parsed.host;
      }
    } catch {
      safeJobUrl = null;
    }
  }

  return (
    <div className="space-y-6">
      <Link href="/app/applications" className="text-sm text-[rgb(var(--muted))]">
        ← Back to applications
      </Link>

      {searchParams?.created ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          Application created. You can keep refining the details here.
        </div>
      ) : null}

      <Section
        title="Edit application"
        description="Update the role details and keep status current."
      >
        <ApplicationForm
          mode="edit"
          initialValues={application}
          action={updateApplicationAction}
        />
      </Section>

      <Section
        title="Job advert"
        description="Keep the original listing link handy."
      >
        {safeJobUrl ? (
          <JobAdvertCard url={safeJobUrl} host={jobHost} />
        ) : (
          <div className="rounded-2xl border border-dashed border-black/10 bg-white/60 p-4 text-sm text-[rgb(var(--muted))]">
            Not added yet.{" "}
            <Link
              href={`/app/applications/${application.id}#job_url`}
              className="font-semibold text-[rgb(var(--ink))] underline-offset-2 hover:underline"
            >
              Add link
            </Link>
          </div>
        )}
      </Section>

      <RoleFitCard
        result={roleFit}
        hasJobDescription={hasJobDescription}
        hasEvidence={hasEvidence}
        achievements={achievements.map((achievement) => ({
          id: achievement.id,
          title: achievement.title,
          metrics: achievement.metrics,
        }))}
      />

      <AutopacksSection applicationId={application.id} autopacks={autopacks} />

      <Section
        title="Danger zone"
        description="Delete the application if you no longer need it."
      >
        <DeleteApplicationForm
          id={application.id}
          deleteAction={deleteApplicationAction}
          label="Delete application"
        />
      </Section>
    </div>
  );
}
