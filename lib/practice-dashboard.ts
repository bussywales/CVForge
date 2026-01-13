import type { InterviewPracticeScore } from "@/lib/interview-practice";

export type PracticeAnswerSnapshot = {
  answer_text?: string | null;
  score?: number | null;
  rubric_json?: InterviewPracticeScore | null;
  improved_text?: string | null;
  updated_at?: string | null;
};

export type PracticeQuestion = {
  questionKey: string;
  questionText: string;
};

export type PracticeStatus = {
  drafted: boolean;
  scored: boolean;
  improved: boolean;
};

export type PracticeStats = {
  total: number;
  drafted: number;
  scored: number;
  improved: number;
  averageScore: number;
};

export type OrderedPracticeQuestion = PracticeQuestion & {
  status: PracticeStatus;
  score: number;
  updatedAt: string | null;
};

export function deriveStatus(answer?: PracticeAnswerSnapshot | null): PracticeStatus {
  const drafted = Boolean(answer?.answer_text && answer.answer_text.trim().length > 0);
  const scored =
    Boolean(answer?.score && answer.score > 0) ||
    Boolean(answer?.rubric_json && Object.keys(answer.rubric_json).length > 0);
  const improved = Boolean(answer?.improved_text && answer.improved_text.trim().length > 0);
  return { drafted, scored, improved };
}

export function computePracticeStats(
  questions: PracticeQuestion[],
  answers: Record<string, PracticeAnswerSnapshot>
): PracticeStats {
  let drafted = 0;
  let scored = 0;
  let improved = 0;
  let scoreTotal = 0;

  questions.forEach((question) => {
    const answer = answers[question.questionKey];
    const status = deriveStatus(answer);
    if (status.drafted) {
      drafted += 1;
    }
    if (status.scored) {
      scored += 1;
      scoreTotal += answer?.score ?? 0;
    }
    if (status.improved) {
      improved += 1;
    }
  });

  const averageScore = scored > 0 ? Math.round(scoreTotal / scored) : 0;

  return {
    total: questions.length,
    drafted,
    scored,
    improved,
    averageScore,
  };
}

export function orderPracticeQuestions(
  questions: PracticeQuestion[],
  answers: Record<string, PracticeAnswerSnapshot>
): OrderedPracticeQuestion[] {
  const withMeta = questions.map((question) => {
    const answer = answers[question.questionKey];
    const status = deriveStatus(answer);
    const score = answer?.score ?? 0;
    const updatedAt = answer?.updated_at ?? null;
    return {
      ...question,
      status,
      score,
      updatedAt,
    };
  });

  return withMeta.sort((a, b) => {
    const aScored = a.status.scored;
    const bScored = b.status.scored;
    if (aScored !== bScored) {
      return aScored ? 1 : -1;
    }
    if (aScored && bScored && a.score !== b.score) {
      return a.score - b.score;
    }
    const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    return bTime - aTime;
  });
}
