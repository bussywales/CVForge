import type { ApplicationRecord } from "@/lib/data/applications";
import type { ProfileRecord } from "@/lib/data/profile";

export const outreachStageValues = [
  "not_started",
  "applied_sent",
  "followup_1",
  "followup_2",
  "final_nudge",
  "replied",
  "closed",
] as const;

export type OutreachStage = (typeof outreachStageValues)[number];

export const outreachChannelValues = ["email", "linkedin"] as const;
export type OutreachChannel = (typeof outreachChannelValues)[number];

export type OutreachStep = {
  id: string;
  label: string;
  stage: OutreachStage;
  offsetDays: number;
};

export type OutreachTemplate = {
  channel: OutreachChannel;
  subject?: string;
  body: string;
};

type OutreachTemplateInput = {
  channel: OutreachChannel;
  step: OutreachStep;
  application: ApplicationRecord;
  profile: ProfileRecord | null;
  roleFitTopSignals: string[];
  bestMetric: string | null;
};

const outreachSteps: OutreachStep[] = [
  {
    id: "applied",
    label: "Applied confirmation",
    stage: "applied_sent",
    offsetDays: 0,
  },
  {
    id: "followup_1",
    label: "Follow-up",
    stage: "followup_1",
    offsetDays: 3,
  },
  {
    id: "followup_2",
    label: "Follow-up",
    stage: "followup_2",
    offsetDays: 7,
  },
  {
    id: "final_nudge",
    label: "Final nudge",
    stage: "final_nudge",
    offsetDays: 14,
  },
];

export function getOutreachSteps() {
  return outreachSteps;
}

export function getNextOutreachStep(stage: OutreachStage | null) {
  const safeStage = stage ?? "not_started";
  if (safeStage === "replied" || safeStage === "closed") {
    return null;
  }
  if (safeStage === "not_started") {
    return outreachSteps[0];
  }
  const currentIndex = outreachSteps.findIndex(
    (step) => step.stage === safeStage
  );
  if (currentIndex === -1) {
    return outreachSteps[0];
  }
  return outreachSteps[currentIndex + 1] ?? null;
}

export function renderOutreachTemplate({
  channel,
  step,
  application,
  profile,
  roleFitTopSignals,
  bestMetric,
}: OutreachTemplateInput): OutreachTemplate {
  const contactName = application.contact_name?.trim();
  const greetingName = contactName || "Hiring Manager";
  const role = application.job_title?.trim() || "the role";
  const company = application.company_name?.trim() || application.company?.trim();
  const companyLabel = company ? ` at ${company}` : "";
  const signals = roleFitTopSignals.slice(0, 2);
  const signalLine =
    signals.length > 0
      ? `My experience in ${joinSignals(signals)} is a strong match.`
      : "";
  const metricLine = bestMetric ? `Recent impact: ${bestMetric}` : "";

  if (channel === "linkedin") {
    const body = buildBody([
      `Hi ${greetingName},`,
      buildStepLine(step, role, companyLabel),
      signalLine,
      metricLine,
      "Happy to share more detail if helpful.",
    ]);

    return {
      channel,
      body,
    };
  }

  const subject = buildEmailSubject(step, role, company);
  const signOff = profile?.full_name
    ? `Kind regards,\n${profile.full_name}`
    : "Kind regards,";

  const body = buildBody([
    `Hi ${greetingName},`,
    buildStepLine(step, role, companyLabel),
    signalLine,
    metricLine,
    "If useful, I can share further detail or examples.",
    signOff,
  ]);

  return {
    channel,
    subject,
    body,
  };
}

function buildEmailSubject(step: OutreachStep, role: string, company?: string | null) {
  const companyLabel = company ? ` – ${company}` : "";
  switch (step.stage) {
    case "applied_sent":
      return `Application for ${role}${companyLabel}`;
    case "followup_1":
      return `Follow-up on ${role}${companyLabel}`;
    case "followup_2":
      return `Checking in on ${role}${companyLabel}`;
    case "final_nudge":
      return `Final check-in on ${role}${companyLabel}`;
    default:
      return `Follow-up on ${role}${companyLabel}`;
  }
}

function buildStepLine(step: OutreachStep, role: string, companyLabel: string) {
  switch (step.stage) {
    case "applied_sent":
      return `I recently applied for ${role}${companyLabel} and wanted to share a short summary of fit.`;
    case "followup_1":
      return `I'm following up on my application for ${role}${companyLabel}.`;
    case "followup_2":
      return `Just checking in on the ${role}${companyLabel} application.`;
    case "final_nudge":
      return `A final quick check-in on the ${role}${companyLabel} application.`;
    default:
      return `Following up on ${role}${companyLabel}.`;
  }
}

function joinSignals(signals: string[]) {
  if (signals.length <= 1) {
    return signals[0] ?? "";
  }
  if (signals.length === 2) {
    return `${signals[0]} and ${signals[1]}`;
  }
  return `${signals[0]}, ${signals[1]}`;
}

function buildBody(lines: string[]) {
  const trimmed = lines
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  return trimmed.join("\n\n");
}
