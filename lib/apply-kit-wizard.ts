export type WizardStepState = "ready" | "attention" | "blocked";

export type ApplyWizardInputs = {
  jobTextLength: number;
  evidenceGapsWithSelection: number;
  totalGaps: number;
  starDraftCount: number;
  autopackReady: boolean;
  submitted: boolean;
};

export type WizardState = {
  steps: {
    id: string;
    state: WizardStepState;
  }[];
  nextActionId: string;
};

export function computeWizardState(input: ApplyWizardInputs): WizardState {
  const steps: WizardState["steps"] = [];

  // Step 1: job text
  let jobState: WizardStepState = "blocked";
  if (input.jobTextLength >= 800) {
    jobState = "ready";
  } else if (input.jobTextLength >= 200) {
    jobState = "attention";
  }
  steps.push({ id: "job-text", state: jobState });

  // Step 2: evidence
  const evidenceReady = input.evidenceGapsWithSelection >= 2;
  const evidenceAttention = input.evidenceGapsWithSelection === 1;
  steps.push({
    id: "evidence",
    state: evidenceReady ? "ready" : evidenceAttention ? "attention" : "blocked",
  });

  // Step 3: STAR drafts
  const starReady = input.starDraftCount >= 1;
  steps.push({
    id: "star",
    state: starReady ? "ready" : "blocked",
  });

  // Step 4: kit
  steps.push({
    id: "kit",
    state: input.autopackReady ? "ready" : "blocked",
  });

  // Step 5: submitted
  steps.push({
    id: "submit",
    state: input.submitted ? "ready" : "attention",
  });

  const priority = steps.find((step) => step.state === "blocked")
    ?? steps.find((step) => step.state === "attention")
    ?? steps[0];

  return {
    steps,
    nextActionId: priority?.id ?? "job-text",
  };
}
