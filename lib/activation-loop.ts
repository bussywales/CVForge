import type { ApplicationRecord } from "@/lib/data/applications";
import type { InsightSummary } from "@/lib/insights";

export type ActivationStep = {
  id: string;
  title: string;
  description?: string | null;
  ctaLabel: string;
  href: string;
  anchor?: string | null;
  isDone: boolean;
  isAvailable: boolean;
  reasonIfLocked?: string | null;
};

export type ActivationModel = {
  steps: ActivationStep[];
  progress: { doneCount: number; totalCount: number; percent: number };
  nextBest: { id: string; why: string };
  celebration?: string | null;
};

type Input = {
  applications: ApplicationRecord[];
  insights?: InsightSummary | null;
};

function hasInterviewPack(insights?: InsightSummary | null) {
  if (!insights?.activities) return false;
  return insights.activities.some((a) => (a.type ?? "").includes("interview"));
}

function buildStep(
  id: string,
  title: string,
  ctaLabel: string,
  href: string,
  opts?: Partial<Pick<ActivationStep, "description" | "anchor" | "isDone" | "isAvailable" | "reasonIfLocked">>
): ActivationStep {
  return {
    id,
    title,
    ctaLabel,
    href,
    description: opts?.description ?? null,
    anchor: opts?.anchor ?? null,
    isDone: opts?.isDone ?? false,
    isAvailable: opts?.isAvailable ?? true,
    reasonIfLocked: opts?.reasonIfLocked ?? null,
  };
}

export function buildActivationModel(input: Input): ActivationModel {
  const { applications, insights } = input;
  const steps: ActivationStep[] = [];
  const hasApps = applications.length > 0;
  const firstApp = applications[0];
  const outreachDone = applications.some((app) => Boolean(app.outreach_last_sent_at || app.outreach_stage));
  const followupScheduled = applications.some((app) => Boolean(app.outreach_next_due_at || app.next_action_due));
  const outcomeLogged = applications.some((app) => Boolean(app.last_outcome_status || app.outcome_status));
  const interviewStepEnabled = hasInterviewPack(insights);

  if (!hasApps) {
    steps.push(buildStep("add_application", "Add your first application", "Add application", "/app/applications/new", { isDone: false }));
  } else {
    steps.push(
      buildStep(
        "add_application",
        "Add your first application",
        "Add application",
        "/app/applications/new",
        { isDone: true }
      )
    );
    steps.push(
      buildStep(
        "first_outreach",
        "Send your first outreach",
        "Open outreach",
        `/app/applications/${firstApp.id}?tab=activity#outreach`,
        {
          isDone: outreachDone,
          description: "Reach out to the hiring contact with your best template.",
        }
      )
    );
    steps.push(
      buildStep(
        "schedule_followup",
        "Schedule a follow-up",
        "Schedule",
        `/app/applications/${firstApp.id}?tab=activity#outreach`,
        {
          isDone: followupScheduled,
          description: "Set a date so you stay on track.",
        }
      )
    );
    steps.push(
      buildStep(
        "log_outcome",
        "Log an outcome",
        "Log outcome",
        `/app/applications/${firstApp.id}?tab=overview#outcome`,
        {
          isDone: outcomeLogged,
          description: "Track interview invites or responses to keep insights fresh.",
        }
      )
    );
    if (interviewStepEnabled) {
      steps.push(
        buildStep(
          "interview_focus",
          "Run Interview Focus",
          "Open Interview",
          firstApp ? `/app/applications/${firstApp.id}?tab=interview` : "/app/interview",
          {
            isDone: false,
          description: "15-minute prep to land the interview.",
        }
      )
    );
  }

  const allDone = steps.length > 0 && steps.every((step) => step.isDone);
  if (allDone) {
    steps.push(
      buildStep(
        "keep_momentum",
        "Keep momentum",
        "Review pipeline",
        "/app/applications",
        {
          isDone: false,
          description: "Scan your pipeline and queue the next outreach.",
        }
      )
    );
  }
  }

  const totalCount = steps.length || 1;
  const doneCount = steps.filter((s) => s.isDone).length;
  const percent = Math.min(100, Math.round((doneCount / totalCount) * 100));
  const nextStep = steps.find((s) => !s.isDone) ?? steps[0];
  const nextBest = { id: nextStep.id, why: "Unblocks your first value faster." };
  const celebration =
    doneCount > 0 && doneCount === 1
      ? "Nice start — keep going to finish your activation loop."
      : null;

  return {
    steps,
    progress: { doneCount, totalCount, percent },
    nextBest,
    celebration,
  };
}
