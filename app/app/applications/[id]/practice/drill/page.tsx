import Link from "next/link";
import { listAchievements } from "@/lib/data/achievements";
import { fetchApplication } from "@/lib/data/applications";
import { listAutopacks } from "@/lib/data/autopacks";
import { listActiveDomainPacks } from "@/lib/data/domain-packs";
import { fetchProfile } from "@/lib/data/profile";
import { getSupabaseUser } from "@/lib/data/supabase";
import { listStarLibrary } from "@/lib/data/star-library";
import { fetchBillingSettings } from "@/lib/data/billing";
import { getUserCredits, listCreditActivity } from "@/lib/data/credits";
import { buildInterviewLift } from "@/lib/interview-lift";
import { buildInterviewPack } from "@/lib/interview-pack";
import { inferDomainGuess } from "@/lib/jd-learning";
import { getEffectiveJobText } from "@/lib/job-text";
import { buildQuestionKey } from "@/lib/interview-practice";
import { addResumeParam } from "@/lib/billing/pending-action";
import type { InterviewPracticeScore } from "@/lib/interview-practice";
import type { InterviewRewriteNotes } from "@/lib/interview-rewrite";
import { calculateRoleFit } from "@/lib/role-fit";
import type { RoleFitPack } from "@/lib/role-fit";
import { orderPracticeQuestions } from "@/lib/practice-dashboard";
import {
  deriveSubscriptionSignalsFromLedger,
  recommendSubscriptionPlanV2,
} from "@/lib/billing/subscription-reco";
import { recommendPack } from "@/lib/billing/recommendation";
import { CREDIT_PACKS } from "@/lib/billing/packs-data";
import { getPackAvailability } from "@/lib/billing/availability";
import { getSubscriptionStatus } from "@/lib/billing/subscription-status";
import DrillClient from "./drill-client";
import AutopackResumeBanner from "../../../autopack-resume-banner";
import PostPurchaseSuccessBanner from "@/components/PostPurchaseSuccessBanner";
import CompletionWatchdogNudge from "@/components/CompletionWatchdogNudge";

export const dynamic = "force-dynamic";

type PracticeAnswerRow = {
  question_key: string;
  question_text: string | null;
  answer_text: string | null;
  rubric_json: InterviewPracticeScore | null;
  score: number | null;
  improved_text: string | null;
  improved_meta: InterviewRewriteNotes | null;
  improved_updated_at: string | null;
  updated_at: string | null;
  created_at: string | null;
};

export default async function PracticeDrillPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { questionKey?: string; rewrite?: string; success?: string; purchased?: string };
}) {
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

  let credits = 0;
  try {
    credits = await getUserCredits(supabase, user.id);
  } catch (error) {
    console.error("[practice-drill.credits]", error);
  }

  const billingReturn = addResumeParam(
    `/app/applications/${application.id}/practice/drill`
  );

  const profile = await fetchProfile(supabase, user.id);
  const achievements = await listAchievements(supabase, user.id);
  const autopacks = await listAutopacks(supabase, user.id, application.id);
  let dynamicPacks: RoleFitPack[] = [];

  try {
    dynamicPacks = await listActiveDomainPacks(supabase);
  } catch (error) {
    console.error("[practice-drill.packs]", error);
  }

  const jobDescription = getEffectiveJobText(application);
  const evidenceParts = [
    profile?.headline,
    ...achievements.map((achievement) =>
      [achievement.title, achievement.metrics].filter(Boolean).join(" ")
    ),
  ].filter(Boolean) as string[];
  const evidence = evidenceParts.join(" ").trim();
  const domainGuess = inferDomainGuess(
    application.job_title ?? "",
    jobDescription
  );

  const roleFit = calculateRoleFit(jobDescription, evidence, {
    dynamicPacks,
    domainGuess,
  });
  const gapLabels = roleFit.gapSignals.map((gap) => gap.label);

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

  const gapLabelMap = new Map(
    roleFit.gapSignals.map((gap) => [gap.label, gap.id])
  );
  const questionMeta = interviewPack.questions.map((question, index) => {
    const gapKey =
      question.source === "gap"
        ? gapLabelMap.get(question.signals[0] ?? "") ?? null
        : null;
    return {
      questionKey: buildQuestionKey(question.question, index),
      questionText: question.question,
      signals: question.signals,
      gapKey,
    };
  });

  const questions = questionMeta.map((question) => ({
    questionKey: question.questionKey,
    questionText: question.questionText,
    signals: question.signals,
  }));
  const questionGapMap = questionMeta.reduce((acc, item) => {
    acc[item.questionKey] = item.gapKey;
    return acc;
  }, {} as Record<string, string | null>);

  let answersMap: Record<string, PracticeAnswerRow> = {};

  try {
    const { data, error } = await supabase
      .from("interview_practice_answers")
      .select(
        "question_key, question_text, answer_text, rubric_json, score, improved_text, improved_meta, improved_updated_at, updated_at, created_at"
      )
      .eq("user_id", user.id)
      .eq("application_id", application.id);

    if (error) {
      console.error("[practice-drill.answers]", error);
    } else {
      answersMap = (data ?? []).reduce((acc, row) => {
        acc[row.question_key] = {
          ...row,
          rubric_json: row.rubric_json as InterviewPracticeScore | null,
          improved_meta: row.improved_meta as InterviewRewriteNotes | null,
        };
        return acc;
      }, {} as Record<string, PracticeAnswerRow>);
    }
  } catch (error) {
    console.error("[practice-drill.answers]", error);
  }

  const activeApplications =
    (
      await supabase
        .from("applications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
    ).count ?? 0;
  const dueFollowups =
    application.next_action_due && new Date(application.next_action_due) <= new Date()
      ? 1
      : 0;
  const practiceBacklog = Object.keys(answersMap).length;
  const ledgerEntries = await listCreditActivity(supabase, user.id, 120);
  const ledgerSignals = deriveSubscriptionSignalsFromLedger(ledgerEntries);
  const subscriptionReco = recommendSubscriptionPlanV2({
    activeApplications,
    completions7: ledgerSignals.completions7,
    creditsSpent30: ledgerSignals.creditsSpent30,
    topups30: ledgerSignals.topups30,
  });
  const recommendedSubscriptionPlan = subscriptionReco.recommendedPlanKey;
  const subscriptionStatus = await getSubscriptionStatus(supabase, user.id);
  const hasSubscription = subscriptionStatus.hasActiveSubscription;
  const currentPlanKey = subscriptionStatus.currentPlanKey;
  const packAvailability = getPackAvailability();
  const planAvailability = subscriptionStatus.availablePlans;
  const upgradeSuggested =
    hasSubscription && currentPlanKey === "monthly_30" && recommendedSubscriptionPlan === "monthly_80";
  const packRecommendation = recommendPack({
    credits,
    activeApplications,
    dueFollowups,
    practiceBacklog,
    stage: "draft",
  });
  const recommendedPack =
    CREDIT_PACKS.find((pack) => pack.key === packRecommendation.recommendedPack) ??
    CREDIT_PACKS[0];

  const orderedQuestions = orderPracticeQuestions(
    questions.map(({ questionKey, questionText }) => ({
      questionKey,
      questionText,
    })),
    answersMap
  );

  const orderedKeys = orderedQuestions.map((question) => question.questionKey);
  const initialKey = searchParams?.questionKey;
  const initialIndex = initialKey
    ? Math.max(0, orderedKeys.indexOf(initialKey))
    : 0;

  let starLibraryMap: Record<string, { id: string; title: string; situation: string; task: string; action: string; result: string }> = {};
  try {
    const drafts = await listStarLibrary(supabase, user.id, application.id);
    starLibraryMap = drafts.reduce((acc, draft) => {
      acc[draft.gap_key] = {
        id: draft.id,
        title: draft.title,
        situation: draft.situation,
        task: draft.task,
        action: draft.action,
        result: draft.result,
      };
      return acc;
    }, {} as Record<string, { id: string; title: string; situation: string; task: string; action: string; result: string }>);
  } catch (error) {
    console.error("[practice-drill.star-library]", error);
  }

  return (
    <div className="space-y-4">
      <PostPurchaseSuccessBanner
        applicationId={application.id}
        surface="applications"
        show={Boolean(searchParams?.success || searchParams?.purchased)}
      />
      <CompletionWatchdogNudge
        applicationId={application.id}
        surface="applications"
        fallbackHref={`/app/applications/${application.id}/practice`}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/app/applications/${application.id}/practice`}
          className="text-sm text-[rgb(var(--muted))]"
        >
          ← Back to dashboard
        </Link>
        <Link
          href={`/app/applications/${application.id}`}
          className="text-sm font-semibold text-[rgb(var(--ink))]"
        >
          View application
        </Link>
      </div>

      <AutopackResumeBanner applicationId={application.id} />

      {credits <= 2 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          Low credits.{" "}
          <Link
            href={`/app/billing?returnTo=${encodeURIComponent(billingReturn)}`}
            className="font-semibold underline-offset-2 hover:underline"
          >
            Top up
          </Link>{" "}
          to keep generating packs.
        </div>
      ) : null}

      <DrillClient
        applicationId={application.id}
        questions={questions}
        orderedKeys={orderedKeys}
        initialIndex={initialIndex}
        initialQuestionKey={initialKey ?? null}
        initialRewriteOpen={searchParams?.rewrite === "1"}
        gapLabels={gapLabels}
        questionGapMap={questionGapMap}
        starLibraryMap={starLibraryMap}
        initialAnswers={answersMap}
        balance={credits}
        returnTo={`/app/applications/${application.id}/practice/drill${
          searchParams?.questionKey ? `?questionKey=${encodeURIComponent(searchParams.questionKey)}` : ""
        }`}
        recommendedPlanKey={recommendedSubscriptionPlan}
        hasSubscription={hasSubscription}
        recommendedPackKey={recommendedPack.key}
        packAvailability={packAvailability}
        planAvailability={planAvailability}
        currentPlanKey={currentPlanKey}
        upgradeSuggested={upgradeSuggested}
      />
    </div>
  );
}
