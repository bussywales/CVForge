export type OnboardingStepStatus = "not_started" | "in_progress" | "done";

export type OnboardingStep = {
  id: string;
  title: string;
  hint: string;
  href: string;
  status: OnboardingStepStatus;
};

export type OnboardingInputs = {
  achievementsCount: number;
  workHistoryCount: number;
  applicationsCount: number;
  latestApplicationId?: string | null;
};

export function computeOnboardingSteps(
  input: OnboardingInputs
): { steps: OnboardingStep[]; completed: number; total: number } {
  const steps: OnboardingStep[] = [];

  const stepAStatus =
    input.achievementsCount + input.workHistoryCount > 0
      ? "done"
      : "not_started";
  steps.push({
    id: "import",
    title: "Import your CV (DOCX)",
    hint: "Use the profile importer to pull in basics.",
    href: "/app/profile",
    status: stepAStatus,
  });

  const stepBStatus =
    input.achievementsCount >= 3
      ? "done"
      : input.achievementsCount > 0
      ? "in_progress"
      : "not_started";
  steps.push({
    id: "achievements",
    title: "Add 3 achievements with metrics",
    hint: "Keep each achievement short with an outcome.",
    href: "/app/profile#achievements",
    status: stepBStatus,
  });

  const stepCStatus =
    input.workHistoryCount >= 1
      ? "done"
      : input.workHistoryCount > 0
      ? "in_progress"
      : "not_started";
  steps.push({
    id: "work-history",
    title: "Add 1 work history role",
    hint: "Add a recent role with bullets.",
    href: "/app/profile#work-history",
    status: stepCStatus,
  });

  const stepDStatus =
    input.applicationsCount >= 1 ? "done" : "not_started";
  steps.push({
    id: "application",
    title: "Create an application",
    hint: "Paste the JD or link so Role Fit can help.",
    href: "/app/applications/new",
    status: stepDStatus,
  });

  const stepEStatus =
    input.applicationsCount >= 1 ? "in_progress" : "not_started";
  const targetAppHref = input.latestApplicationId
    ? `/app/applications/${input.latestApplicationId}?tab=overview#apply-kit-wizard`
    : "/app/applications/new";
  steps.push({
    id: "wizard",
    title: "Run Apply Kit Wizard",
    hint: "Generate kit, export, and mark submitted.",
    href: targetAppHref,
    status: stepEStatus,
  });

  const completed = steps.filter((step) => step.status === "done").length;

  return { steps, completed, total: steps.length };
}
