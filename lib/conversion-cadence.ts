export type CadenceInput = {
  status: string | null;
  lastActivityAt?: string | null;
  nextActionDue?: string | null;
  closingDate?: string | null;
};

export type CadenceAction = {
  id: string;
  label: string;
  dueAt?: string | null;
  channel?: "email" | "linkedin";
  templateId?: string;
  reason?: string;
};

export type CadencePlan = {
  nextAction?: CadenceAction;
  secondaryActions: CadenceAction[];
  reason?: string;
};

export function buildCadence(input: CadenceInput): CadencePlan {
  const actions: CadenceAction[] = [];
  const now = new Date();
  const status = (input.status ?? "").toLowerCase();

  const lastActivity = input.lastActivityAt ? new Date(input.lastActivityAt) : null;
  const daysSinceActivity =
    lastActivity && !Number.isNaN(lastActivity.getTime())
      ? diffDays(now, lastActivity)
      : Number.POSITIVE_INFINITY;

  const nextDue =
    input.nextActionDue && !Number.isNaN(new Date(input.nextActionDue).getTime())
      ? new Date(input.nextActionDue)
      : null;
  const nextDueOverdue =
    nextDue && nextDue.getTime() <= now.getTime() ? nextDue : null;

  if (nextDueOverdue) {
    actions.push({
      id: "scheduled",
      label: "Scheduled follow-up",
      dueAt: nextDueOverdue.toISOString().slice(0, 10),
      channel: "email",
      templateId: "post-apply",
      reason: "Follow-up reminder is due.",
    });
  }

  if (status === "applied") {
    if (daysSinceActivity >= 7) {
      actions.push({
        id: "linkedin-followup",
        label: "Follow up on LinkedIn",
        channel: "linkedin",
        templateId: "linkedin-dm",
        reason: "No activity for a week after applying.",
      });
    } else if (daysSinceActivity >= 2) {
      actions.push({
        id: "email-followup",
        label: "Follow up by email",
        channel: "email",
        templateId: "post-apply",
        reason: "No activity 2+ days after applying.",
      });
    }
  }

  const closing = input.closingDate ? new Date(input.closingDate) : null;
  if (
    closing &&
    !Number.isNaN(closing.getTime()) &&
    status !== "submitted" &&
    diffDays(closing, now) <= 2
  ) {
    actions.unshift({
      id: "submit-now",
      label: "Submit now",
      reason: "Closing date within 48 hours.",
    });
  }

  if (status === "interviewing" && daysSinceActivity > 0) {
    actions.push({
      id: "practice-today",
      label: "Practise 2 questions",
      reason: "Interviewing with no prep logged today.",
    });
  }

  const nextAction = actions[0];
  const secondaryActions = actions.slice(1, 3);

  return {
    nextAction,
    secondaryActions,
    reason: nextAction?.reason,
  };
}

function diffDays(later: Date, earlier: Date) {
  const ms = later.getTime() - earlier.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}
