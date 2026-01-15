import Link from "next/link";
import dynamic from "next/dynamic";
import Section from "@/components/Section";
import { listAchievements } from "@/lib/data/achievements";
import { listApplicationActivities } from "@/lib/data/application-activities";
import { fetchApplication } from "@/lib/data/applications";
import { listAutopacks } from "@/lib/data/autopacks";
import { listActiveDomainPacks } from "@/lib/data/domain-packs";
import { listStarLibrary, type StarLibraryRecord } from "@/lib/data/star-library";
import { logLearningEvent } from "@/lib/data/learning";
import { fetchProfile } from "@/lib/data/profile";
import { getSupabaseUser } from "@/lib/data/supabase";
import {
  fetchApplyChecklist,
  type ApplyChecklistRecord,
} from "@/lib/apply-checklist";
import { buildFollowupTemplates, buildLinkedInTemplate } from "@/lib/followup-templates";
import { getEffectiveJobText, getJobTextMeta } from "@/lib/job-text";
import { buildInterviewLift } from "@/lib/interview-lift";
import { buildInterviewPack } from "@/lib/interview-pack";
import { inferDomainGuess } from "@/lib/jd-learning";
import { calculateRoleFit } from "@/lib/role-fit";
import type { RoleFitPack } from "@/lib/role-fit";
import { buildCadence } from "@/lib/conversion-cadence";
import { buildQuestionKey } from "@/lib/interview-practice";
import {
  computeKitChecklist,
  getKitContentsList,
} from "@/lib/application-kit";
import type { PracticeAnswerSnapshot } from "@/lib/practice-dashboard";
import {
  createActivityAction,
  createFollowupFromTemplateAction,
  deleteActivityAction,
  deleteApplicationAction,
  logAppliedAction,
  logFollowupAction,
  logFollowupCadenceAction,
  scheduleFollowupAction,
  setSubmittedAction,
  setOutcomeAction,
  updateApplicationAction,
  updateClosingDateAction,
  updateSourcePlatformAction,
  updateTrackingAction,
} from "../actions";
import ApplicationDetailTabs from "../application-detail-tabs";
import ApplicationForm from "../application-form";
import AutopacksSection from "../autopacks-section";
import DeleteApplicationForm from "../delete-application-form";
import JobAdvertCard from "../job-advert-card";
import { applicationStatusLabels, normaliseApplicationStatus } from "@/lib/application-status";
import { computeTabBadges, ApplicationDetailTabKey, parseTab } from "@/lib/ui/tabs";

const RoleFitCard = dynamic(() => import("../role-fit-card"), {
  ssr: false,
  loading: () => (
    <div className="rounded-2xl border border-slate-200 px-4 py-6 text-sm text-[rgb(var(--muted))]">
      Loading role fit…
    </div>
  ),
});

const StarLibraryPanel = dynamic(() => import("../star-library-panel"), {
  ssr: false,
  loading: () => (
    <div className="rounded-2xl border border-slate-200 px-4 py-6 text-sm text-[rgb(var(--muted))]">
      Loading STAR drafts…
    </div>
  ),
});

const InterviewLiftPanel = dynamic(
  () => import("../interview-lift-panel"),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-2xl border border-slate-200 px-4 py-6 text-sm text-[rgb(var(--muted))]">
        Loading Interview Lift…
      </div>
    ),
  }
);

const InterviewPackPanel = dynamic(
  () => import("../interview-pack-panel"),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-2xl border border-slate-200 px-4 py-6 text-sm text-[rgb(var(--muted))]">
        Loading Interview Pack…
      </div>
    ),
  }
);

const ApplicationKitPanel = dynamic(
  () => import("../application-kit-panel"),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-2xl border border-slate-200 px-4 py-6 text-sm text-[rgb(var(--muted))]">
        Loading Smart Apply…
      </div>
    ),
  }
);

const FollowupSection = dynamic(() => import("../followup-section"), {
  ssr: false,
  loading: () => (
    <div className="rounded-2xl border border-slate-200 px-4 py-6 text-sm text-[rgb(var(--muted))]">
      Loading follow-up templates…
    </div>
  ),
});

const TrackingPanel = dynamic(() => import("../tracking-panel"), {
  ssr: false,
  loading: () => (
    <div className="rounded-2xl border border-slate-200 px-4 py-6 text-sm text-[rgb(var(--muted))]">
      Loading tracking…
    </div>
  ),
});

const ActivityPanel = dynamic(() => import("../activity-panel"), {
  ssr: false,
  loading: () => (
    <div className="rounded-2xl border border-slate-200 px-4 py-6 text-sm text-[rgb(var(--muted))]">
      Loading activity log…
    </div>
  ),
});

type ApplicationPageProps = {
  params: { id: string };
  searchParams?: { created?: string; tab?: string };
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
  const jobDescription = getEffectiveJobText(application);
  const jobTextMeta = getJobTextMeta(application);
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

  const practiceQuestions = interviewPack.questions.map((question, index) => ({
    questionKey: buildQuestionKey(question.question, index),
    questionText: question.question,
  }));

  let practiceAnswers: Record<string, PracticeAnswerSnapshot> = {};
  try {
    const { data, error } = await supabase
      .from("interview_practice_answers")
      .select(
        "question_key, question_text, answer_text, rubric_json, score, improved_text, updated_at"
      )
      .eq("user_id", user.id)
      .eq("application_id", application.id);

    if (error) {
      console.error("[application.kit.practice]", error);
    } else {
      practiceAnswers = (data ?? []).reduce((acc, row) => {
        acc[row.question_key] = row as PracticeAnswerSnapshot;
        return acc;
      }, {} as Record<string, PracticeAnswerSnapshot>);
    }
  } catch (error) {
    console.error("[application.kit.practice]", error);
  }

let applyChecklist: ApplyChecklistRecord | null = null;
  try {
    applyChecklist = await fetchApplyChecklist(
      supabase,
      user.id,
      application.id
    );
  } catch (error) {
    console.error("[application.kit.checklist]", error);
  }

  const kitChecklist = computeKitChecklist({
    applicationId: application.id,
    profileHeadline: profile?.headline ?? null,
    profileName: profile?.full_name ?? null,
    userEmail: user.email ?? null,
    achievements,
    autopack: latestAutopack
      ? {
          id: latestAutopack.id,
          cv_text: latestAutopack.cv_text,
          cover_letter: latestAutopack.cover_letter,
        }
      : null,
    checklist: applyChecklist,
    closingDate: application.closing_date,
    submittedAt: application.submitted_at,
    nextActionDue: application.next_action_due,
    outreachStage: application.outreach_stage,
    practiceQuestions,
    practiceAnswers,
    starDrafts: application.star_drafts,
    activities,
    contactName: application.contact_name,
    contactEmail: application.contact_email,
    contactLinkedin: application.contact_linkedin,
    status: application.status,
  });

  const kitContents = getKitContentsList();
  const jobUrl = application.job_url?.trim() ?? "";
  let safeJobUrl: string | null = null;
  let jobHost = "";
  let starLibrary: StarLibraryRecord[] = [];
  let starEvidenceCount = 0;

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

  try {
    starLibrary = await listStarLibrary(supabase, user.id, application.id);
  } catch (error) {
    console.error("[star-library.list]", error);
  }

  try {
    const { count, error } = await supabase
      .from("application_evidence")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("application_id", application.id)
      .eq("use_star", true);
    if (error) {
      console.error("[star-library.count]", error);
    }
    starEvidenceCount = count ?? 0;
  } catch (error) {
    console.error("[star-library.count]", error);
  }

  const status = normaliseApplicationStatus(application.status);
  const statusLabel =
    applicationStatusLabels[status] ??
    application.status ??
    "Draft";
  const jobDescriptionText = application.job_description?.trim() ?? "";
  const descriptionLength = jobDescriptionText.length;
  const lastUpdatedReference = application.created_at;
  const updatedWithinWeek = lastUpdatedReference
    ? Date.now() - new Date(lastUpdatedReference).getTime() <=
      7 * 24 * 60 * 60 * 1000
    : false;
  const shouldCollapseForm =
    jobDescriptionText.length > 0 &&
    (updatedWithinWeek || descriptionLength > 200);
  const editFormOpen = !shouldCollapseForm;

  const activeTab = parseTab(searchParams?.tab);
  const hasTabParam = Boolean(searchParams?.tab);
  const createdParam = searchParams?.created ?? null;

  const checklistFields = [
    "cv_exported_at",
    "cover_exported_at",
    "interview_pack_exported_at",
    "kit_downloaded_at",
    "outreach_step1_logged_at",
    "followup_scheduled_at",
    "submitted_logged_at",
  ] as const;
  const checklistData = applyChecklist;
  const pendingApplyItems = checklistData
    ? checklistFields.filter((field) => !checklistData[field]).length
    : 0;

  const evidenceGaps = roleFit.gapSignals.length;
  const interviewPriority = Math.max(
    kitChecklist.stats.total - kitChecklist.stats.scored,
    0
  );
  const nextActionDue = application.next_action_due
    ? new Date(application.next_action_due)
    : null;
  const hasDueAction =
    !!nextActionDue && nextActionDue.getTime() <= new Date().getTime();
  const tabBadges = computeTabBadges({
    pendingApplyItems,
    evidenceGaps,
    interviewPriority,
    hasDueAction,
  });

  const cadence = buildCadence({
    status: application.status,
    lastActivityAt: application.last_activity_at ?? application.last_touch_at,
    nextActionDue: application.next_action_due,
    closingDate: application.closing_date,
  });

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
  const cadenceTemplate =
    cadence.nextAction?.channel === "linkedin"
      ? buildLinkedInTemplate({
          contactName: application.contact_name,
          companyName: application.company_name ?? application.company,
          jobTitle: application.job_title,
        })
      : followupTemplates[0] ?? null;

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

      <ApplicationDetailTabs
        applicationId={application.id}
        defaultTab={activeTab}
        hasTabParam={hasTabParam}
        createdParam={createdParam}
        badges={tabBadges}
      />

      {activeTab === "overview" ? (
        <>
          <Section
            title="Edit application"
            description="Update the role details and keep status current."
          >
            <details
              open={editFormOpen}
              className="w-full rounded-2xl border border-black/10 bg-white/70"
            >
              <summary className="flex items-center justify-between gap-4 px-4 py-3 text-sm font-semibold text-[rgb(var(--ink))]">
                <div>
                  <p>{application.job_title ?? "Untitled role"}</p>
                  <p className="text-xs text-[rgb(var(--muted))]">
                    {application.company_name ?? application.company ?? "—"}
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-600">
                  {statusLabel}
                </span>
                <span className="text-xs text-[rgb(var(--muted))]">Edit</span>
              </summary>
              <div className="border-t border-black/10 px-4 py-5">
                <ApplicationForm
                  mode="edit"
                  initialValues={application}
                  action={updateApplicationAction}
                />
              </div>
            </details>
          </Section>

          <Section
            title="Job advert"
            description="Keep the original listing link handy."
          >
          {safeJobUrl ? (
            <JobAdvertCard
              applicationId={application.id}
              url={safeJobUrl}
              host={jobHost}
              source={jobTextMeta.source}
              status={jobTextMeta.status}
              fetchedAt={jobTextMeta.fetchedAt}
              chars={jobTextMeta.chars}
              error={jobTextMeta.error}
              sourceUrl={jobTextMeta.sourceUrl}
              blocked={jobTextMeta.status === "blocked"}
              blockedMessage={jobTextMeta.blockedMessage}
            />
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
        </>
      ) : null}

      {activeTab === "apply" ? (
        <>
          <div id="apply">
            <Section
              title="Smart Apply"
              description="Track readiness, submission steps, and next actions."
            >
              <ApplicationKitPanel
                applicationId={application.id}
                closingDate={application.closing_date}
                submittedAt={application.submitted_at}
                sourcePlatform={application.source_platform}
                outcomeStatus={application.outcome_status}
                outcomeNote={application.outcome_note}
                checklist={kitChecklist.items}
                score={kitChecklist.score}
                nextActions={kitChecklist.nextActions}
                cadence={cadence.nextAction ?? null}
                followupTemplate={
                  cadenceTemplate
                    ? {
                        subject: cadenceTemplate.subject,
                        body: cadenceTemplate.body,
                        label: cadenceTemplate.label,
                      }
                    : null
                }
                downloadEnabled={Boolean(latestAutopack?.id)}
                downloadHint={
                  latestAutopack?.id
                    ? undefined
                    : "Generate an autopack first to enable the kit download."
                }
                contents={kitContents}
                updateClosingDateAction={updateClosingDateAction}
                updateSourcePlatformAction={updateSourcePlatformAction}
                setSubmittedAction={setSubmittedAction}
                scheduleFollowupAction={scheduleFollowupAction}
                logFollowupCadenceAction={logFollowupCadenceAction}
                setOutcomeAction={setOutcomeAction}
              />
            </Section>
          </div>

          <div id="apply-autopacks">
            <AutopacksSection applicationId={application.id} autopacks={autopacks} />
          </div>
        </>
      ) : null}

      {activeTab === "evidence" ? (
        <>
          <Section
            title="Role Fit"
            description="Score coverage and view evidence suggestions."
          >
            <RoleFitCard
              applicationId={application.id}
              result={roleFit}
              hasJobDescription={hasJobDescription}
              hasEvidence={hasEvidence}
              achievements={achievements.map((achievement) => ({
                id: achievement.id,
                title: achievement.title,
                metrics: achievement.metrics,
              }))}
              selectedEvidence={application.selected_evidence}
            />
          </Section>

          <Section
            title="STAR Library"
            description="Turn STAR-target evidence into practice-ready drafts."
          >
            <StarLibraryPanel
              applicationId={application.id}
              gaps={roleFit.gapSignals}
              drafts={starLibrary}
              starEvidenceCount={starEvidenceCount}
            />
          </Section>
        </>
      ) : null}

      {activeTab === "interview" ? (
        <>
          <Section
            title="Interview Lift"
            description="Focus on the actions most likely to improve interview outcomes."
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

          <div id="interview-pack">
            <Section
              title="Interview Pack"
              description="Turn role-fit gaps and signals into interview-ready prompts."
              action={
                <Link
                  href={`/app/applications/${application.id}/practice`}
                  className="inline-flex items-center justify-center rounded-2xl border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-[rgb(var(--ink))]"
                >
                  Practice Dashboard
                </Link>
              }
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
          </div>
        </>
      ) : null}

      {activeTab === "activity" ? (
        <>
          <Section
            title="Tracking"
            description="Keep key dates, contacts, and reminders in one place."
          >
            <TrackingPanel
              application={application}
              updateAction={updateTrackingAction}
            />
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
        </>
      ) : null}

      {activeTab === "admin" ? (
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
      ) : null}
    </div>
  );
}
