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
import { buildNextBestActions } from "@/lib/next-best-actions";
import { buildQuestionKey } from "@/lib/interview-practice";
import { buildInterviewFocusSession } from "@/lib/interview-focus-session";
import {
  computeKitChecklist,
  getKitContentsList,
} from "@/lib/application-kit";
import type { PracticeAnswerSnapshot } from "@/lib/practice-dashboard";
import {
  deriveSubscriptionSignalsFromLedger,
  recommendSubscriptionPlanV2,
} from "@/lib/billing/subscription-reco";
import { getSubscriptionStatus } from "@/lib/billing/subscription-status";
import { getPackAvailability, getPlanAvailability } from "@/lib/billing/availability";
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
import ApplyKitWizard from "../apply-kit-wizard";
import NextBestActionsBar from "../next-best-actions-bar";
import OutcomeLoopPanel from "../outcome-loop-panel";
import { applicationStatusLabels, normaliseApplicationStatus } from "@/lib/application-status";
import { computeTabBadges, ApplicationDetailTabKey, parseTab } from "@/lib/ui/tabs";
import { listOutcomes, type OutcomeRecord } from "@/lib/data/outcomes";
import {
  computeActionSummaryForApplication,
  type ActionSummary,
} from "@/lib/outcome-loop";
import { normalizeSelectedEvidence } from "@/lib/evidence";
import { getUserCredits, listCreditActivity } from "@/lib/data/credits";
import PackSelector from "@/app/app/billing/pack-selector";
import { fetchBillingSettings } from "@/lib/data/billing";
import AutopackResumeBanner from "../autopack-resume-banner";
import PostPurchaseSuccessBanner from "@/components/PostPurchaseSuccessBanner";
import ResumeCompletionNudge from "@/components/ResumeCompletionNudge";
import CompletionWatchdogNudge from "@/components/CompletionWatchdogNudge";
import { getIsoWeekKey } from "@/lib/weekly-review";
import InterviewFocusSessionCard from "../interview-focus-session-card";
import OfferPackPanel from "../offer-pack-panel";
import OfferCloseoutPanel from "../offer-closeout-panel";
import { buildOutreachRecommendation } from "@/lib/outreach-engine";
import OutreachPanel from "../outreach-panel";
import { buildNextMove } from "@/lib/outreach-next-move";
import SupportFocusClient from "../support-focus-client";

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
  searchParams?: { created?: string; tab?: string; success?: string; purchased?: string };
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

  let application;
  try {
    application = await fetchApplication(supabase, user.id, params.id);
  } catch (error) {
    console.error("[application.load]", error);
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        Unable to load this application right now. Please refresh or try again.
      </div>
    );
  }

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
  const credits = await getUserCredits(supabase, user.id);
  const ledgerEntries = await listCreditActivity(supabase, user.id, 120);
  const billingSettings = await fetchBillingSettings(supabase, user.id);
  const subscriptionStatus = await getSubscriptionStatus(supabase, user.id);
  const activeApplications =
    (
      await supabase
        .from("applications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
    ).count ?? 0;
  const dueFollowups =
    (
      await supabase
        .from("applications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .lte("next_action_due", new Date().toISOString())
    ).count ?? 0;
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
  const practiceBacklog = Object.keys(practiceAnswers).length;
  const weekKey = getIsoWeekKey(new Date());
  const interviewFocusSession = buildInterviewFocusSession({
    applicationId: application.id,
    questions: interviewPack.questions.map((question, index) => ({
      key: buildQuestionKey(question.question, index),
      question: question.question,
      priority: question.priority,
      source: question.source,
      index,
      answerText: practiceAnswers[buildQuestionKey(question.question, index)]?.improved_text,
    })),
    answers: practiceAnswers,
  });
  const outreachRecommendation = buildOutreachRecommendation({
    application,
    roleFitSignals: roleFit.matchedSignals.map((signal) => signal.label),
    bestMetric: achievements[0]?.metrics ?? null,
  });
  const outreachTriageActivity = activities
    .filter((activity) => activity.type === "outreach.triage")
    .sort((a, b) => {
      const aTime = a.occurred_at ? new Date(a.occurred_at).getTime() : 0;
      const bTime = b.occurred_at ? new Date(b.occurred_at).getTime() : 0;
      return bTime - aTime;
    })[0];
  const outreachTriageStatus =
    outreachTriageActivity?.subject ||
    (application.outreach_stage?.startsWith("triage_")
      ? application.outreach_stage.replace("triage_", "")
      : null);
  const outreachTriageNotes = outreachTriageActivity?.body ?? null;
  const outreachNextMove = buildNextMove({
    application,
    triage: outreachTriageStatus,
    hasCredits: credits > 0,
  });

  let outcomes: OutcomeRecord[] = [];
  let outcomeActions: ActionSummary | null = null;
  try {
    outcomes = await listOutcomes(supabase, user.id, application.id, 10);
    outcomeActions = await computeActionSummaryForApplication(
      supabase,
      user.id,
      application.id
    );
  } catch (error) {
    console.error("[application.outcomes]", error);
  }

  let otherApplications: any[] = [];
  try {
    const { data, error } = await supabase
      .from("applications")
      .select(
        "id, job_title, company, company_name, status, contact_email, contact_linkedin, outreach_stage, next_action_due, outreach_next_due_at"
      )
      .eq("user_id", user.id)
      .neq("id", application.id)
      .order("updated_at", { ascending: false })
      .limit(10);
    if (!error && data) {
      otherApplications = data;
    }
  } catch (error) {
    console.error("[application.closeout.list]", error);
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
  const selectedEvidence = normalizeSelectedEvidence(
    application.selected_evidence
  );
  const evidenceByGap = selectedEvidence.reduce((acc, entry) => {
    acc[entry.signalId] = (acc[entry.signalId] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const evidenceGapsWithSelection = Object.keys(evidenceByGap).length;
  const starDraftCount = kitChecklist.starDraftCount ?? 0;
  const jobTextLength = jobDescription.length;
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
  const ledgerSignals = deriveSubscriptionSignalsFromLedger(ledgerEntries);
  const subscriptionPlanReco = recommendSubscriptionPlanV2({
    activeApplications,
    completions7: ledgerSignals.completions7,
    creditsSpent30: ledgerSignals.creditsSpent30,
    topups30: ledgerSignals.topups30,
  });
  const recommendedSubscriptionPlan = subscriptionPlanReco.recommendedPlanKey;
  const hasSubscription = subscriptionStatus.hasActiveSubscription;
  const currentPlanKey = subscriptionStatus.currentPlanKey;
  const packAvailability = getPackAvailability();
  const planAvailability = subscriptionStatus.availablePlans;
  const upgradeSuggested =
    hasSubscription && currentPlanKey === "monthly_30" && recommendedSubscriptionPlan === "monthly_80";
  const recommendedGatePackKey = credits >= 20 ? "pro" : "starter";

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

  const nextBestActions = buildNextBestActions({
    applicationId: application.id,
    closingDate: application.closing_date,
    pendingApplyItems,
    jobTextStatus: jobTextMeta.status,
    hasJobText: hasJobDescription,
    roleFitGaps: roleFit.gapSignals.length,
    starDraftCount: kitChecklist.starDraftCount,
    practiceTotal: kitChecklist.stats.total,
    practiceScored: kitChecklist.stats.scored,
    hasDueFollowup: hasDueAction,
    isSubmitted:
      application.status === "submitted" || Boolean(application.submitted_at),
    outcomeRecorded: Boolean(application.last_outcome_status),
    lastOutcomeStatus: application.last_outcome_status,
  });

  return (
    <div className="space-y-6">
      <SupportFocusClient applicationId={application.id} />
      <PostPurchaseSuccessBanner
        applicationId={application.id}
        surface="applications"
        show={Boolean(searchParams?.success || searchParams?.purchased)}
      />
      <Link href="/app/applications" className="text-sm text-[rgb(var(--muted))]">
        ← Back to applications
      </Link>
      <AutopackResumeBanner applicationId={application.id} />
      {credits <= 2 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          Low credits.{" "}
          <Link
            href={`/app/billing?returnTo=${encodeURIComponent(`/app/applications/${application.id}?tab=${activeTab}`)}`}
            className="font-semibold underline-offset-2 hover:underline"
          >
            Top up to keep moving
          </Link>
          .
        </div>
      ) : null}

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
      <NextBestActionsBar
        applicationId={application.id}
        actions={nextBestActions}
      />
      <ResumeCompletionNudge
        applicationId={application.id}
        actions={nextBestActions}
      />
      <CompletionWatchdogNudge applicationId={application.id} />

      {activeTab === "overview" ? (
        <>
          <Section
            title="Apply Kit Wizard"
            description="Guided path: advert → evidence → STAR → kit → submit."
          >
            <ApplyKitWizard
              applicationId={application.id}
              jobTextLength={jobTextLength}
              jobTextStatus={jobTextMeta.status}
              jobTextSource={jobTextMeta.source}
              hasJobUrl={Boolean(safeJobUrl)}
              evidenceGapsWithSelection={evidenceGapsWithSelection}
              totalGaps={roleFit.gapSignals.length}
              starDraftCount={starDraftCount}
              autopackReady={Boolean(latestAutopack?.id)}
              submittedAt={application.submitted_at}
              setSubmittedAction={setSubmittedAction}
              scheduleFollowupAction={scheduleFollowupAction}
            />
          </Section>

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

          <div id="job-advert">
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
          </div>

          <div id="outcome">
            <Section
              title="Outcome loop"
              description="Record outcomes and see what actions you took."
            >
              <OutcomeLoopPanel
                applicationId={application.id}
                initialOutcomes={outcomes}
                actionSummary={
                  outcomeActions ?? {
                    evidence_selected: 0,
                    outreach_logged: 0,
                    practice_answers: 0,
                    answer_pack_generated: 0,
                    kit_downloaded: 0,
                    exports: 0,
                    followups_logged: 0,
                  }
                }
                lastOutcomeStatus={application.last_outcome_status}
                lastOutcomeAt={application.last_outcome_at}
              />
            </Section>
          </div>

          <div id="offer-pack">
            <Section
              title="Offer & Negotiation Pack"
              description="Structured summary, counter, and scripts once an offer arrives."
            >
              <OfferPackPanel
                applicationId={application.id}
                roleTitle={application.job_title}
                company={application.company_name ?? application.company}
                hasOfferOutcome={(application.last_outcome_status ?? application.outcome_status) === "offer"}
              />
            </Section>
          </div>

          <div id="offer-closeout">
            <Section
              title="Close-out loop"
              description="Clean up parallel applications after you accept."
            >
              <OfferCloseoutPanel
                applicationId={application.id}
                weekKey={weekKey}
                apps={otherApplications.map((app: any) => ({
                  id: app.id,
                  role: app.job_title,
                  company: app.company_name ?? app.company ?? "—",
                  status: app.status,
                  contactEmail: app.contact_email,
                  contactLinkedin: app.contact_linkedin,
                  outreachStage: app.outreach_stage,
                  nextActionDue: app.next_action_due ?? app.outreach_next_due_at,
                }))}
              />
            </Section>
          </div>
        </>
      ) : null}

      {activeTab === "apply" ? (
        <>
          <div id="apply">
            {billingSettings &&
            credits <= (billingSettings.auto_topup_threshold ?? 0) &&
            billingSettings.auto_topup_enabled ? (
              <div className="mb-4 rounded-3xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-sm font-semibold text-emerald-800">
                  Auto top-up is on (when ≤ {billingSettings.auto_topup_threshold} credits).
                </p>
                <div className="mt-2">
                  <PackSelector
                    contextLabel="Top up now"
                    returnTo={`/app/applications/${application.id}?tab=apply#apply-autopacks`}
                    compact
                    applicationId={application.id}
                    surface="apply"
                    packAvailability={packAvailability}
                  />
                </div>
              </div>
            ) : credits <= 0 ? (
              <div className="mb-4 rounded-3xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-800">
                  Ready to generate? Top up credits to continue.
                </p>
                <p className="text-xs text-amber-700">
                  Applies to Autopacks, Application Kit, and interview exports.
                </p>
                <div className="mt-3">
                  <PackSelector
                    contextLabel="Generate and export"
                    returnTo={`/app/applications/${application.id}?tab=apply#apply-autopacks`}
                    compact
                    onPurchasedHint="You’ll return here after checkout."
                    applicationId={application.id}
                    surface="apply"
                    packAvailability={packAvailability}
                  />
                </div>
              </div>
            ) : null}
            <Section
              title="Smart Apply"
              description="Track readiness, submission steps, and next actions."
            >
              <ApplyKitWizard
                applicationId={application.id}
                jobTextLength={jobTextLength}
                jobTextStatus={jobTextMeta.status}
                jobTextSource={jobTextMeta.source}
                hasJobUrl={Boolean(safeJobUrl)}
                evidenceGapsWithSelection={evidenceGapsWithSelection}
                totalGaps={roleFit.gapSignals.length}
                starDraftCount={starDraftCount}
                autopackReady={Boolean(latestAutopack?.id)}
                submittedAt={application.submitted_at}
                setSubmittedAction={setSubmittedAction}
                scheduleFollowupAction={scheduleFollowupAction}
              />
            </Section>
            <div id="application-kit">
              <Section
                title="Application Kit"
                description="Checklist, next actions, and kit download."
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
                balance={credits}
                returnTo={`/app/applications/${application.id}?tab=apply#application-kit`}
                recommendedPlanKey={recommendedSubscriptionPlan}
                hasSubscription={hasSubscription}
                currentPlanKey={currentPlanKey}
                upgradeSuggested={upgradeSuggested}
                recommendedPackKey={recommendedGatePackKey}
                packAvailability={packAvailability}
                planAvailability={planAvailability}
              />
              </Section>
            </div>
          </div>

          <div id="apply-kit">
            <div id="apply-autopacks">
            <AutopacksSection
              applicationId={application.id}
              autopacks={autopacks}
              balance={credits}
              returnTo={`/app/applications/${application.id}?tab=apply#apply-autopacks`}
              recommendedPlanKey={recommendedSubscriptionPlan}
              hasSubscription={hasSubscription}
              currentPlanKey={currentPlanKey}
              upgradeSuggested={upgradeSuggested}
              recommendedPackKey={recommendedGatePackKey}
              packAvailability={packAvailability}
              planAvailability={planAvailability}
            />
            </div>
          </div>
        </>
      ) : null}

      {activeTab === "evidence" ? (
        <>
          <div id="role-fit">
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
          </div>

          <div id="star-library">
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
          </div>
        </>
      ) : null}

      {activeTab === "interview" ? (
        <>
          {credits <= 0 ? (
            <div className="mb-4 rounded-3xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-800">
                Top up to generate Interview/Answer Packs.
              </p>
              <div className="mt-2">
                <PackSelector
                  contextLabel="Interview prep"
                  returnTo={`/app/applications/${application.id}?tab=interview#interview-pack`}
                  compact
                  applicationId={application.id}
                  surface="interview"
                  packAvailability={packAvailability}
                />
              </div>
            </div>
          ) : null}
          <div id="interview-lift">
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
          </div>

          <div id="interview-focus-session">
            <Section
              title="Interview Focus Session"
              description="Guided 15–25 minute sprint to raise interview readiness."
            >
              <InterviewFocusSessionCard
                applicationId={application.id}
                weekKey={weekKey}
                session={interviewFocusSession}
              />
            </Section>
          </div>

          <div id="interview-pack">
            <Section
              title="Interview Pack"
              description="Turn role-fit gaps and signals into interview-ready prompts."
              action={
                <Link
                  href={`/app/applications/${application.id}/practice`}
                  className="inline-flex items-center justify-center rounded-2xl border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-[rgb(var(--ink))]"
                  id="practice-dashboard"
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
                balance={credits}
                returnTo={`/app/applications/${application.id}?tab=interview#interview-pack`}
                recommendedPlanKey={recommendedSubscriptionPlan}
                hasSubscription={hasSubscription}
                recommendedPackKey={recommendedGatePackKey}
                packAvailability={packAvailability}
                planAvailability={planAvailability}
              />
              <div id="answer-pack" />
            </Section>
          </div>
        </>
      ) : null}

      {activeTab === "activity" ? (
        <>
          <div id="tracking">
            <Section
              title="Tracking"
              description="Keep key dates, contacts, and reminders in one place."
            >
              <TrackingPanel
                application={application}
                updateAction={updateTrackingAction}
              />
            </Section>
          </div>

          <div id="followup-autopilot">
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
          </div>

          <div id="outreach">
            <Section
              title="Outreach"
              description="Copy, send, log, and schedule the next follow-up."
            >
              <OutreachPanel
                applicationId={application.id}
                statusLabel={statusLabel}
                recommendation={outreachRecommendation}
                nextDue={application.outreach_next_due_at ?? application.next_followup_at ?? application.next_action_due}
                contactName={application.contact_name}
                contactEmail={application.contact_email}
                contactLinkedin={application.contact_linkedin}
                jobTitle={application.job_title}
                company={application.company_name ?? application.company}
                triageStatus={outreachTriageStatus}
                triageNotes={outreachTriageNotes}
                nextMove={outreachNextMove}
              />
            </Section>
          </div>

          <div id="activity-log">
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
          </div>
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
