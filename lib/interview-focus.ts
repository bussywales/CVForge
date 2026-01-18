import type { InterviewPackQuestion } from "@/lib/interview-pack";
import { deriveStatus, type PracticeAnswerSnapshot } from "@/lib/practice-dashboard";

export type InterviewFocusItem = {
  key: string;
  label: string;
  reason: string;
  href: string;
  priority: number;
  quality: "Draft" | "Solid" | "Strong";
  nextStep: string;
  source?: InterviewPackQuestion["source"];
};

type FocusInput = {
  applicationId: string;
  questions: Array<
    Pick<InterviewPackQuestion, "question" | "priority" | "source"> & {
      key: string;
      index: number;
    }
  >;
  answers: Record<string, PracticeAnswerSnapshot>;
};

export function assessAnswerQuality(answer?: PracticeAnswerSnapshot | null) {
  const text = (answer?.improved_text || answer?.answer_text || "").trim();
  const wordCount = text ? text.split(/\s+/).length : 0;
  const score = answer?.score ?? 0;
  const status = deriveStatus(answer);

  if (!status.drafted) {
    return {
      quality: "Draft" as const,
      nextStep: "Add a first draft with STAR.",
      priority: 1,
      drafted: false,
      score,
    };
  }

  if (score >= 75 || (wordCount > 140 && score >= 65)) {
    return {
      quality: "Strong" as const,
      nextStep: "Polish metrics and timing.",
      priority: 4,
      drafted: true,
      score,
    };
  }

  if (score >= 55 || wordCount >= 90 || status.improved) {
    return {
      quality: "Solid" as const,
      nextStep: "Tighten impact and add a metric.",
      priority: 3,
      drafted: true,
      score,
    };
  }

  return {
    quality: "Draft" as const,
    nextStep: "Short or low score — rewrite with STAR.",
    priority: 2,
    drafted: true,
    score,
  };
}

export function buildInterviewFocus(input: FocusInput): InterviewFocusItem[] {
  const candidates = input.questions.map((question) => {
    const answer = input.answers[question.key];
    const quality = assessAnswerQuality(answer);
    const reason = buildReason(quality, answer);
    const priorityBump =
      question.priority === "high" ? -0.2 : question.priority === "low" ? 0.2 : 0;

    return {
      key: question.key,
      label: question.question,
      reason,
      href: `/app/applications/${input.applicationId}?tab=interview#answerpack-q-${question.index}`,
      priority: quality.priority + priorityBump + question.index * 0.001,
      quality: quality.quality,
      nextStep: quality.nextStep,
      source: question.source,
    };
  });

  candidates.sort((a, b) => a.priority - b.priority);

  const bySource = new Map<string | undefined, InterviewFocusItem[]>();
  candidates.forEach((item) => {
    const list = bySource.get(item.source) ?? [];
    list.push(item);
    bySource.set(item.source, list);
  });

  const result: InterviewFocusItem[] = [];

  // First pass: take one per source (if multiple sources exist) to keep diversity.
  if (bySource.size > 1) {
    candidates.forEach((item) => {
      if (result.length >= 3) return;
      const existing = result.find((entry) => entry.source === item.source);
      if (!existing) {
        result.push(item);
      }
    });
  }

  // Second pass: fill remaining slots.
  candidates.forEach((item) => {
    if (result.length >= 3) return;
    if (!result.find((entry) => entry.key === item.key)) {
      result.push(item);
    }
  });

  return result.slice(0, 3);
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
