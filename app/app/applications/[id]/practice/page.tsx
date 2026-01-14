import Link from "next/link";
import Section from "@/components/Section";
import { listAchievements } from "@/lib/data/achievements";
import { fetchApplication } from "@/lib/data/applications";
import { listAutopacks } from "@/lib/data/autopacks";
import { listActiveDomainPacks } from "@/lib/data/domain-packs";
import { fetchProfile } from "@/lib/data/profile";
import { getSupabaseUser } from "@/lib/data/supabase";
import { listStarLibrary } from "@/lib/data/star-library";
import { buildInterviewLift } from "@/lib/interview-lift";
import { buildInterviewPack } from "@/lib/interview-pack";
import { inferDomainGuess } from "@/lib/jd-learning";
import { getEffectiveJobText } from "@/lib/job-text";
import { buildQuestionKey } from "@/lib/interview-practice";
import type { InterviewPracticeScore } from "@/lib/interview-practice";
import type { InterviewRewriteNotes } from "@/lib/interview-rewrite";
import { calculateRoleFit } from "@/lib/role-fit";
import type { RoleFitPack } from "@/lib/role-fit";
import {
  computePracticeStats,
  orderPracticeQuestions,
} from "@/lib/practice-dashboard";

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

type AnswerPackRow = {
  question_key: string;
  variant: "standard" | "short90";
};

function truncate(value: string, max = 120) {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max - 1)}…`;
}

export default async function PracticeDashboardPage({
  params,
}: {
  params: { id: string };
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
    console.error("[practice-dashboard.packs]", error);
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
      gapKey,
    };
  });
  const questions = questionMeta.map(({ questionKey, questionText }) => ({
    questionKey,
    questionText,
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
      console.error("[practice-dashboard.answers]", error);
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
    console.error("[practice-dashboard.answers]", error);
  }

  const stats = computePracticeStats(questions, answersMap);
  const orderedQuestions = orderPracticeQuestions(questions, answersMap);
  let answerPackMap: Record<
    string,
    { standard: boolean; short90: boolean }
  > = {};
  let starLibraryMap: Record<string, { id: string }> = {};

  try {
    const drafts = await listStarLibrary(supabase, user.id, application.id);
    starLibraryMap = drafts.reduce((acc, draft) => {
      acc[draft.gap_key] = draft;
      return acc;
    }, {} as Record<string, { id: string }>);
  } catch (error) {
    console.error("[practice-dashboard.star-library]", error);
  }

  try {
    const { data, error } = await supabase
      .from("interview_answer_pack")
      .select("question_key, variant")
      .eq("user_id", user.id)
      .eq("application_id", application.id);
    if (error) {
      console.error("[practice-dashboard.answer-pack]", error);
    } else {
      answerPackMap = (data as AnswerPackRow[]).reduce((acc, row) => {
        if (!acc[row.question_key]) {
          acc[row.question_key] = { standard: false, short90: false };
        }
        acc[row.question_key][row.variant] = true;
        return acc;
      }, {} as Record<string, { standard: boolean; short90: boolean }>);
    }
  } catch (error) {
    console.error("[practice-dashboard.answer-pack]", error);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/app/applications/${application.id}`}
          className="text-sm text-[rgb(var(--muted))]"
        >
          ← Back to application
        </Link>
        <Link
          href={`/app/applications/${application.id}/practice/drill`}
          className="inline-flex items-center justify-center rounded-2xl bg-[rgb(var(--accent))] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[rgb(var(--accent-strong))]"
        >
          Start Drill Mode
        </Link>
      </div>

      <Section
        title="Practice Dashboard"
        description="Focus on the lowest scores first and improve answers quickly."
      >
        <div className="space-y-6">
          <div className="grid gap-3 md:grid-cols-5">
            {[
              { label: "Questions", value: stats.total },
              { label: "Drafted", value: stats.drafted },
              { label: "Scored", value: stats.scored },
              { label: "Improved", value: stats.improved },
              { label: "Average score", value: stats.averageScore },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-black/10 bg-white/80 p-4"
              >
                <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
                  {item.label}
                </p>
                <p className="mt-2 text-2xl font-semibold text-[rgb(var(--ink))]">
                  {item.value}
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-dashed border-black/10 bg-white/70 p-3 text-xs text-[rgb(var(--muted))]">
            Lowest score first — focus on adding outcomes and metrics.
          </div>

          <div className="space-y-3">
            {orderedQuestions.map((question) => {
              const answer = answersMap[question.questionKey];
              const drafted = question.status.drafted;
              const scored = question.status.scored;
              const improved = question.status.improved;
              const score = scored ? question.score : 0;
              const gapKey = questionGapMap[question.questionKey];
              const starReady = gapKey ? Boolean(starLibraryMap[gapKey]) : false;
              const answerPack = answerPackMap[question.questionKey];

              return (
                <div
                  key={question.questionKey}
                  className="rounded-2xl border border-black/10 bg-white/80 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-[rgb(var(--ink))]">
                        {truncate(question.questionText, 140)}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {drafted ? (
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-semibold text-slate-600">
                            Drafted
                          </span>
                        ) : null}
                        {scored ? (
                          <span className="rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-semibold text-emerald-700">
                            Scored
                          </span>
                        ) : null}
                        {improved ? (
                          <span className="rounded-full bg-indigo-100 px-3 py-1 text-[10px] font-semibold text-indigo-700">
                            Improved
                          </span>
                        ) : null}
                        {starReady ? (
                          <span className="rounded-full bg-sky-100 px-3 py-1 text-[10px] font-semibold text-sky-700">
                            STAR ready
                          </span>
                        ) : null}
                        {answerPack?.standard ? (
                          <span className="rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-semibold text-emerald-700">
                            Answer ready
                          </span>
                        ) : null}
                        {answerPack?.short90 ? (
                          <span className="rounded-full bg-indigo-100 px-3 py-1 text-[10px] font-semibold text-indigo-700">
                            90s ready
                          </span>
                        ) : null}
                        {!drafted && !scored && !improved ? (
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-semibold text-slate-500">
                            Not started
                          </span>
                        ) : null}
                        <span
                          className={`rounded-full px-3 py-1 text-[10px] font-semibold ${
                            scored
                              ? score >= 80
                                ? "bg-emerald-100 text-emerald-700"
                                : score >= 60
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-red-100 text-red-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {scored ? `Score ${score}` : "Score —"}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/app/applications/${application.id}/practice/drill?questionKey=${encodeURIComponent(question.questionKey)}`}
                        className="inline-flex items-center justify-center rounded-2xl border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-[rgb(var(--ink))]"
                      >
                        Practise
                      </Link>
                      {scored ? (
                        <Link
                          href={`/app/applications/${application.id}/practice/drill?questionKey=${encodeURIComponent(question.questionKey)}&rewrite=1`}
                          className="inline-flex items-center justify-center rounded-2xl border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-[rgb(var(--ink))]"
                        >
                          Rewrite
                        </Link>
                      ) : null}
                      <Link
                        href={`/app/applications/${application.id}#interview-pack`}
                        className="inline-flex items-center justify-center rounded-2xl border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-[rgb(var(--ink))]"
                      >
                        Open in pack
                      </Link>
                    </div>
                  </div>
                  {answer?.answer_text ? (
                    <p className="mt-3 text-xs text-[rgb(var(--muted))]">
                      {truncate(answer.answer_text.replace(/\s+/g, " "), 160)}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </Section>
    </div>
  );
}
