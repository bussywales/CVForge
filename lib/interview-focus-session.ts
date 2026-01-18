import { assessAnswerQuality } from "@/lib/interview-focus";
import type { PracticeAnswerSnapshot } from "@/lib/practice-dashboard";

export type InterviewSessionQuestion = {
  key: string;
  label: string;
  href: string;
  reason: string;
  quality: "Draft" | "Solid" | "Strong";
  qualityHint: string;
  source?: string | null;
  answerText?: string | null;
};

type SessionInput = {
  applicationId: string;
  questions: Array<{
    key: string;
    question: string;
    priority: "high" | "medium" | "low" | string;
    source?: string | null;
    index: number;
    answerText?: string | null;
  }>;
  answers: Record<string, PracticeAnswerSnapshot>;
};

export type InterviewFocusSession = {
  sessionId: string;
  estimatedMinutes: number;
  questions: InterviewSessionQuestion[];
};

export function buildInterviewFocusSession(input: SessionInput): InterviewFocusSession {
  const sessionId = "v3";
  const candidates = input.questions.map((question) => {
    const answer = input.answers[question.key];
    const quality = assessAnswerQuality(answer);
    const reason = buildReason(quality, answer);
    const priorityBump =
      question.priority === "high" ? -0.2 : question.priority === "low" ? 0.2 : 0;

    return {
      key: question.key,
      label: question.question,
      href: `/app/applications/${input.applicationId}?tab=interview#answerpack-q-${question.index}`,
      reason,
      quality: quality.quality,
      qualityHint: quality.nextStep,
      source: question.source,
      answerText: answer?.improved_text || answer?.answer_text || null,
      priority: quality.priority + priorityBump + question.index * 0.001,
    };
  });

  candidates.sort((a, b) => a.priority - b.priority);

  const seenSources = new Set<string | undefined | null>();
  const picked: InterviewSessionQuestion[] = [];

  candidates.forEach((candidate) => {
    if (picked.length >= 7) return;
    if (candidate.source && !seenSources.has(candidate.source)) {
      picked.push(strip(candidate));
      seenSources.add(candidate.source);
    }
  });

  candidates.forEach((candidate) => {
    if (picked.length >= 7) return;
    if (!picked.find((item) => item.key === candidate.key)) {
      picked.push(strip(candidate));
    }
  });

  const estimatedMinutes = Math.min(25, Math.max(15, picked.length * 3 || 20));

  return {
    sessionId,
    estimatedMinutes,
    questions: picked,
  };
}

export function buildSessionCtaLabel(quality: "Draft" | "Solid" | "Strong", isReady: boolean) {
  if (isReady) return "Ready";
  if (quality === "Draft") return "Draft answer";
  if (quality === "Solid") return "Improve answer";
  return "Ready";
}

function strip(candidate: any): InterviewSessionQuestion {
  return {
    key: candidate.key,
    label: candidate.label,
    href: candidate.href,
    reason: candidate.reason,
    quality: candidate.quality,
    qualityHint: candidate.qualityHint,
    source: candidate.source,
    answerText: candidate.answerText,
  };
}

function buildReason(
  quality: ReturnType<typeof assessAnswerQuality>,
  answer?: PracticeAnswerSnapshot | null
) {
  if (!quality.drafted) {
    return "No draft yet — start with a concise STAR.";
  }
  const score = answer?.score ?? 0;
  if (score > 0 && score < 60) {
    return "Score is low — tighten clarity and metrics.";
  }
  if (!answer?.improved_text) {
    return "Draft saved — add an improved pass for polish.";
  }
  return "Solid baseline — refine metrics to hit strong.";
}
