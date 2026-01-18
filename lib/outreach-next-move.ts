export type OutreachNextMove =
  | "followup_send"
  | "followup_schedule"
  | "log_outcome"
  | "prep_interview"
  | "generate_autopack"
  | "none";

type OutreachLike = {
  id: string;
  outreach_stage?: string | null;
  outreach_next_due_at?: string | null;
  next_followup_at?: string | null;
  next_action_due?: string | null;
  outcome_status?: string | null;
};

export function buildNextMove(input: {
  application: OutreachLike;
  triage?: string | null;
  hasCredits?: boolean;
}): { key: OutreachNextMove; label: string; href: string; why: string } {
  const stage = String(input.application.outreach_stage ?? "");
  const triage = input.triage ?? (stage.startsWith("triage_") ? stage.replace("triage_", "") : null);
  const nextDue = input.application.outreach_next_due_at ?? input.application.next_followup_at ?? input.application.next_action_due;

  if (triage === "rejected") {
    return {
      key: "log_outcome",
      label: "Log outcome",
      href: `/app/applications/${input.application.id}?tab=overview#outcome`,
      why: "They replied with a rejection — keep pipeline accurate.",
    };
  }
  if (triage === "interested") {
    return {
      key: "prep_interview",
      label: "Prepare interview",
      href: `/app/applications/${input.application.id}?tab=interview`,
      why: "Positive response — prep for interview next.",
    };
  }

  const overdue = nextDue ? new Date(nextDue).getTime() <= Date.now() : false;
  if (overdue) {
    return {
      key: "followup_send",
      label: "Send follow-up",
      href: `/app/applications/${input.application.id}?tab=activity#outreach`,
      why: "Follow-up is due — send a quick check-in.",
    };
  }

  if (triage === "not_now") {
    return {
      key: "followup_schedule",
      label: "Schedule follow-up",
      href: `/app/applications/${input.application.id}?tab=activity#outreach`,
      why: "They asked to wait — schedule the next nudge.",
    };
  }

  if (triage === "no_response") {
    return {
      key: "followup_send",
      label: "Send follow-up",
      href: `/app/applications/${input.application.id}?tab=activity#outreach`,
      why: "No reply yet — send the next template.",
    };
  }

  if (input.hasCredits && !input.application.outcome_status) {
    return {
      key: "generate_autopack",
      label: "Generate Autopack",
      href: `/app/applications/${input.application.id}?tab=apply#apply-autopacks`,
      why: "Improve the next touch with a stronger pack.",
    };
  }

  return {
    key: "followup_schedule",
    label: "Schedule follow-up",
    href: `/app/applications/${input.application.id}?tab=activity#outreach`,
    why: "Stay on track with a scheduled follow-up.",
  };
}
