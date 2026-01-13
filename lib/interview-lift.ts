import type { RoleFitResult, RoleFitSignalGap } from "@/lib/role-fit";
import {
  calculateKeywordCoverage,
  countMetricBullets,
  detectMissingSections,
  detectPlaceholders,
} from "@/lib/submission-quality";
import { extractTopTerms } from "@/lib/jd-learning";
import { isDueToday, isOverdue } from "@/lib/tracking-utils";

export type InterviewLiftAction = {
  id: "add_evidence" | "add_metric" | "draft_star";
  title: string;
  description: string;
  gap?: RoleFitSignalGap;
  fallbackTerm?: string;
  metricSuggestions?: string[];
  actionSuggestion?: string;
};

export type InterviewLiftResult = {
  score: number;
  roleFitCoverage: number;
  metricsCoverage: number;
  cadenceStatus: "ok" | "due" | "overdue" | "missing";
  keywordCoverage: number;
  placeholderRisk: boolean;
  actions: InterviewLiftAction[];
};

type InterviewLiftInput = {
  roleFit: RoleFitResult;
  jobDescription: string;
  evidence: string;
  cvText?: string | null;
  coverLetter?: string | null;
  nextActionDue?: string | null;
  lastLiftAction?: string | null;
};

export function buildInterviewLift(input: InterviewLiftInput): InterviewLiftResult {
  const { roleFit, jobDescription, evidence } = input;
  const cvText = input.cvText ?? "";
  const coverLetter = input.coverLetter ?? "";

  const keywordCoverage = calculateKeywordCoverage(jobDescription, evidence);
  const metricCoverage = countMetricBullets(cvText);
  const missingSections = detectMissingSections(cvText);
  const hasPlaceholders =
    detectPlaceholders(cvText) || detectPlaceholders(coverLetter);

  const metricsCoveragePct =
    metricCoverage.bulletCount === 0
      ? 0
      : Math.round((metricCoverage.metricCount / metricCoverage.bulletCount) * 100);

  let qualityScore = Math.round(
    (keywordCoverage.coveragePct + metricsCoveragePct) / 2
  );
  if (hasPlaceholders) {
    qualityScore = Math.max(0, qualityScore - 20);
  }
  if (metricCoverage.longBullets > 0) {
    qualityScore = Math.max(0, qualityScore - 10);
  }
  if (!missingSections.hasExperience || !missingSections.hasSkills) {
    qualityScore = Math.max(0, qualityScore - 10);
  }

  const cadenceStatus = resolveCadence(input.nextActionDue);
  const cadenceScore =
    cadenceStatus === "ok"
      ? 100
      : cadenceStatus === "due"
        ? 70
        : cadenceStatus === "overdue"
          ? 30
          : 0;

  const roleFitCoverage = roleFit.coveragePct ?? 0;
  const rawScore =
    roleFitCoverage * 0.4 + qualityScore * 0.4 + cadenceScore * 0.2;
  const score = Math.round(Math.min(100, Math.max(0, rawScore)));

  const gap = pickGap(roleFit.gapSignals);
  const fallbackTerm = gap ? undefined : extractTopTerms(jobDescription)[0];
  const actionSuggestion = gap?.primaryAction || gap?.actionSuggestions[0] || "";
  const metricSuggestions = gap?.metricSuggestions?.slice(0, 2) ?? [];

  const actions: InterviewLiftAction[] = [
    {
      id: "add_evidence",
      title: "Add 1 role-evidence line",
      description: gap
        ? `Ground ${gap.label} with a clear action line.`
        : fallbackTerm
          ? `Capture evidence for ${fallbackTerm}.`
          : "Add a line that maps to the job description.",
      gap: gap ?? undefined,
      fallbackTerm,
      actionSuggestion,
    },
    {
      id: "add_metric",
      title: "Add 1 metric",
      description:
        metricCoverage.metricCount === 0
          ? "Quantify impact with a crisp metric statement."
          : "Add another measurable result to strengthen impact.",
      gap: gap ?? undefined,
      metricSuggestions,
    },
    {
      id: "draft_star",
      title: "Draft 1 STAR answer",
      description: "Turn an achievement into a STAR answer ready to refine.",
    },
  ];

  if (input.lastLiftAction) {
    const index = actions.findIndex((action) => action.id === input.lastLiftAction);
    if (index >= 0) {
      const [recent] = actions.splice(index, 1);
      actions.push(recent);
    }
  }

  return {
    score,
    roleFitCoverage,
    metricsCoverage: metricsCoveragePct,
    cadenceStatus,
    keywordCoverage: keywordCoverage.coveragePct,
    placeholderRisk: hasPlaceholders,
    actions,
  };
}

function resolveCadence(nextActionDue?: string | null) {
  if (!nextActionDue) {
    return "missing" as const;
  }
  if (isOverdue(nextActionDue)) {
    return "overdue" as const;
  }
  if (isDueToday(nextActionDue)) {
    return "due" as const;
  }
  return "ok" as const;
}

function pickGap(gaps: RoleFitSignalGap[]) {
  if (!gaps.length) {
    return null;
  }
  const packGap = gaps.find((gap) => gap.allowActions);
  return packGap ?? gaps[0];
}
