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
  primaryApplicationId?: string | null;
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
  const activeApps = applications
    .filter((app) => (app.status ?? "").toString().toLowerCase() !== "archived")
    .sort((a, b) => {
      const aDate = a.last_activity_at ?? a.updated_at ?? a.created_at;
      const bDate = b.last_activity_at ?? b.updated_at ?? b.created_at;
      return (bDate ?? "").localeCompare(aDate ?? "");
    });
  const primaryApp = activeApps[0];
  const hasApps = activeApps.length > 0;
  const outreachDone = activeApps.some((app) => Boolean(app.outreach_last_sent_at || app.outreach_stage));
  const followupScheduled = activeApps.some((app) =>
    Boolean(app.outreach_next_due_at || app.next_action_due || app.next_followup_at)
  );
  const outcomeLogged = activeApps.some((app) => Boolean(app.last_outcome_status || app.outcome_status || app.outcome_at));
  const interviewStepEnabled = hasInterviewPack(insights);

  const appUnavailableHint = hasApps ? null : "Add an application to unlock this step.";
  const outreachHref = primaryApp ? `/app/applications/${primaryApp.id}?tab=activity#outreach` : "/app/applications/new";
  const followupHref = primaryApp ? `/app/applications/${primaryApp.id}?tab=activity#outreach` : "/app/applications/new";
  const outcomeHref = primaryApp ? `/app/applications/${primaryApp.id}?tab=overview#outcome` : "/app/applications/new";
  const interviewHref = primaryApp ? `/app/applications/${primaryApp.id}?tab=interview#interview-focus` : "/app/applications/new";

  steps.push(
    buildStep("add_application", "Add your first application", "Add application", "/app/applications/new", {
      isDone: hasApps,
      description: "Create an application so we can guide outreach and outcomes.",
    })
  );

  steps.push(
    buildStep("first_outreach", "Send your first outreach", "Open outreach", outreachHref, {
      isDone: outreachDone,
      description: "Reach out to the hiring contact with your best template.",
      isAvailable: hasApps,
      reasonIfLocked: appUnavailableHint,
    })
  );

  steps.push(
    buildStep("schedule_followup", "Schedule a follow-up", "Schedule", followupHref, {
      isDone: followupScheduled,
      description: "Set a date so you stay on track.",
      isAvailable: hasApps,
      reasonIfLocked: appUnavailableHint,
    })
  );

  steps.push(
    buildStep("log_outcome", "Log an outcome", "Log outcome", outcomeHref, {
      isDone: outcomeLogged,
      description: "Track interview invites or responses to keep insights fresh.",
      isAvailable: hasApps,
      reasonIfLocked: appUnavailableHint,
    })
  );

  if (interviewStepEnabled) {
    steps.push(
      buildStep("interview_focus", "Run Interview Focus", "Open Interview", interviewHref, {
        isDone: false,
        description: "15-minute prep to land the interview.",
        isAvailable: hasApps,
        reasonIfLocked: appUnavailableHint,
      })
    );
  }

  const allDone = steps.length > 0 && steps.every((step) => step.isDone);
  if (allDone) {
    steps.push(
      buildStep("keep_momentum", "Keep momentum", "Review pipeline", "/app/applications", {
        isDone: false,
        description: "Scan your pipeline and queue the next outreach.",
      })
    );
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
    primaryApplicationId: primaryApp?.id ?? null,
  };
}

export function activationCoreProgress(steps: ActivationStep[]) {
  const coreIds = ["add_application", "first_outreach", "schedule_followup", "log_outcome"];
  const coreSteps = steps.filter((s) => coreIds.includes(s.id));
  const doneCount = coreSteps.filter((s) => s.isDone).length;
  const totalCount = coreSteps.length || 4;
  return { doneCount, totalCount };
}
