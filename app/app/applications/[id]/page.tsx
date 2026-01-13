import Link from "next/link";
import Section from "@/components/Section";
import { listAchievements } from "@/lib/data/achievements";
import { listApplicationActivities } from "@/lib/data/application-activities";
import { fetchApplication } from "@/lib/data/applications";
import { listAutopacks } from "@/lib/data/autopacks";
import { listActiveDomainPacks } from "@/lib/data/domain-packs";
import { logLearningEvent } from "@/lib/data/learning";
import { fetchProfile } from "@/lib/data/profile";
import { getSupabaseUser } from "@/lib/data/supabase";
import { buildFollowupTemplates } from "@/lib/followup-templates";
import { buildInterviewLift } from "@/lib/interview-lift";
import { buildInterviewPack } from "@/lib/interview-pack";
import { inferDomainGuess } from "@/lib/jd-learning";
import { calculateRoleFit } from "@/lib/role-fit";
import type { RoleFitPack } from "@/lib/role-fit";
import {
  createActivityAction,
  createFollowupFromTemplateAction,
  deleteActivityAction,
  deleteApplicationAction,
  logAppliedAction,
  logFollowupAction,
  updateApplicationAction,
  updateTrackingAction,
} from "../actions";
import ApplicationForm from "../application-form";
import AutopacksSection from "../autopacks-section";
import DeleteApplicationForm from "../delete-application-form";
import FollowupSection from "../followup-section";
import InterviewLiftPanel from "../interview-lift-panel";
import InterviewPackPanel from "../interview-pack-panel";
import JobAdvertCard from "../job-advert-card";
import RoleFitCard from "../role-fit-card";
import TrackingPanel from "../tracking-panel";
import ActivityPanel from "../activity-panel";

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
  const activities = await listApplicationActivities(
    supabase,
    user.id,
    application.id
  );
  const jobDescription = application.job_description ?? "";
  let dynamicPacks: RoleFitPack[] = [];

  try {
    dynamicPacks = await listActiveDomainPacks(supabase);
  } catch (error) {
    console.error("[role-fit.packs]", error);
  }

  const evidenceParts = [
    profile?.headline,
    ...achievements.map((achievement) =>
      [achievement.title, achievement.metrics].filter(Boolean).join(" ")
    ),
  ].filter(Boolean) as string[];
  const evidence = evidenceParts.join(" ").trim();
  const hasJobDescription = Boolean(jobDescription.trim());
  const hasEvidence = Boolean(evidence);
  const domainGuess = inferDomainGuess(
    application.job_title ?? "",
    jobDescription
  );
  const roleFit = calculateRoleFit(jobDescription, evidence, {
    dynamicPacks,
    domainGuess,
  });
  const latestAutopack = autopacks[0];
  const interviewLift = buildInterviewLift({
    roleFit,
    jobDescription,
    evidence,
    cvText: latestAutopack?.cv_text ?? "",
    coverLetter: latestAutopack?.cover_letter ?? "",
    nextActionDue: application.next_action_due,
    lastLiftAction: application.last_lift_action,
  });
  const interviewPack = buildInterviewPack({
    jobTitle: application.job_title,
    company: application.company_name ?? application.company,
    jobDescription,
    roleFit,
    interviewLift,
  });
  await logLearningEvent({
    supabase,
    userId: user.id,
    application,
    roleFit,
    telemetryOptIn: Boolean(profile?.telemetry_opt_in),
  });
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

  const followupTemplates = buildFollowupTemplates({
    contactName: application.contact_name,
    companyName: application.company_name ?? application.company,
    jobTitle: application.job_title,
    appliedAt: application.applied_at,
    jobUrl: application.job_url,
    fullName: profile?.full_name,
  });
  const calendarUrl = application.next_followup_at
    ? `/api/calendar/followup?applicationId=${application.id}`
    : null;

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

      <Section
        title="Tracking"
        description="Keep key dates, contacts, and reminders in one place."
      >
        <TrackingPanel application={application} updateAction={updateTrackingAction} />
      </Section>

      <Section
        title="Follow-up"
        description="Copy templates and set the next reminder."
      >
        <FollowupSection
          applicationId={application.id}
          templates={followupTemplates}
          createFollowupAction={createFollowupFromTemplateAction}
          calendarUrl={calendarUrl}
        />
      </Section>

      <Section
        title="Activity"
        description="Log each touchpoint and keep the timeline accurate."
      >
        <ActivityPanel
          applicationId={application.id}
          activities={activities}
          createAction={createActivityAction}
          deleteAction={deleteActivityAction}
          logAppliedAction={logAppliedAction}
          logFollowupAction={logFollowupAction}
        />
      </Section>

      <Section
        title="Interview Lift"
        description="Focus on the next actions most likely to improve interview outcomes."
      >
        <InterviewLiftPanel
          applicationId={application.id}
          result={interviewLift}
          achievements={achievements.map((achievement) => ({
            id: achievement.id,
            title: achievement.title,
            metrics: achievement.metrics,
          }))}
        />
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

      <Section
        title="Interview Pack"
        description="Turn role-fit gaps and signals into interview-ready prompts."
      >
        <InterviewPackPanel
          applicationId={application.id}
          pack={interviewPack}
          achievements={achievements.map((achievement) => ({
            id: achievement.id,
            title: achievement.title,
            metrics: achievement.metrics,
          }))}
        />
      </Section>

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
