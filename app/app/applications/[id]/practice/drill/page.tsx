import Link from "next/link";
import { listAchievements } from "@/lib/data/achievements";
import { fetchApplication } from "@/lib/data/applications";
import { listAutopacks } from "@/lib/data/autopacks";
import { listActiveDomainPacks } from "@/lib/data/domain-packs";
import { fetchProfile } from "@/lib/data/profile";
import { getSupabaseUser } from "@/lib/data/supabase";
import { buildInterviewLift } from "@/lib/interview-lift";
import { buildInterviewPack } from "@/lib/interview-pack";
import { inferDomainGuess } from "@/lib/jd-learning";
import { buildQuestionKey } from "@/lib/interview-practice";
import type { InterviewPracticeScore } from "@/lib/interview-practice";
import type { InterviewRewriteNotes } from "@/lib/interview-rewrite";
import { calculateRoleFit } from "@/lib/role-fit";
import type { RoleFitPack } from "@/lib/role-fit";
import { orderPracticeQuestions } from "@/lib/practice-dashboard";
import DrillClient from "./drill-client";

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
  searchParams?: { questionKey?: string; rewrite?: string };
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

  const profile = await fetchProfile(supabase, user.id);
  const achievements = await listAchievements(supabase, user.id);
  const autopacks = await listAutopacks(supabase, user.id, application.id);
  let dynamicPacks: RoleFitPack[] = [];

  try {
    dynamicPacks = await listActiveDomainPacks(supabase);
  } catch (error) {
    console.error("[practice-drill.packs]", error);
  }

  const jobDescription = application.job_description ?? "";
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

  const questions = interviewPack.questions.map((question, index) => ({
    questionKey: buildQuestionKey(question.question, index),
    questionText: question.question,
    signals: question.signals,
  }));

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

  return (
    <div className="space-y-4">
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

      <DrillClient
        applicationId={application.id}
        questions={questions}
        orderedKeys={orderedKeys}
        initialIndex={initialIndex}
        initialQuestionKey={initialKey ?? null}
        initialRewriteOpen={searchParams?.rewrite === "1"}
        gapLabels={gapLabels}
        initialAnswers={answersMap}
      />
    </div>
  );
}
