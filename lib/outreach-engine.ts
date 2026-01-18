import type { ApplicationRecord } from "@/lib/data/applications";
import { getNextOutreachStep, renderOutreachTemplate } from "@/lib/outreach-templates";

export type OutreachRecommendation = {
  stepId: string;
  stage: string;
  subject?: string;
  body: string;
  dueAt?: string | null;
};

export function buildOutreachRecommendation(input: {
  application: ApplicationRecord;
  roleFitSignals?: string[];
  bestMetric?: string | null;
  now?: Date;
}): OutreachRecommendation | null {
  const { application } = input;
  const now = input.now ?? new Date();
  const stage = application.outreach_stage as string | null;
  if (stage === "replied" || stage === "closed" || application.outcome_status) {
    return null;
  }
  const nextStep = getNextOutreachStep(stage as any);
  if (!nextStep) return null;

  const template = renderOutreachTemplate({
    channel: (application.outreach_channel_pref as any) ?? "email",
    step: nextStep,
    application,
    profile: null,
    roleFitTopSignals: input.roleFitSignals ?? [],
    bestMetric: input.bestMetric ?? null,
  });

  const dueAt = application.outreach_next_due_at ?? application.next_followup_at ?? null;
  return {
    stepId: nextStep.id,
    stage: nextStep.stage,
    subject: template.subject,
    body: template.body,
    dueAt: dueAt ?? nextDueFromOffset(now, nextStep.offsetDays),
  };
}

export function describeFollowupStatus(dueAt?: string | null) {
  if (!dueAt) return "No follow-up due yet";
  const now = new Date();
  const due = new Date(dueAt);
  const diff = due.getTime() - now.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days < 0) return "Overdue — send today";
  if (days === 0) return "Due today";
  if (days <= 3) return "Due soon";
  return "Later";
}

function nextDueFromOffset(base: Date, offsetDays: number) {
  const next = new Date(base);
  next.setDate(next.getDate() + offsetDays);
  return next.toISOString();
}
