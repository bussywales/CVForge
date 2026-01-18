export type NextBestAction = {
  id: string;
  label: string;
  why: string;
  href: string;
};

export type NextBestInput = {
  applicationId: string;
  closingDate?: string | null;
  pendingApplyItems?: number;
  jobTextStatus?: string | null;
  hasJobText?: boolean;
  roleFitGaps?: number;
  starDraftCount?: number;
  practiceTotal?: number;
  practiceScored?: number;
  hasDueFollowup?: boolean;
  isSubmitted?: boolean;
  outcomeRecorded?: boolean;
  lastOutcomeStatus?: string | null;
};

export function buildNextBestActions(input: NextBestInput): NextBestAction[] {
  const actions: NextBestAction[] = [];
  const { applicationId } = input;
  const added = new Set<string>();

  const add = (action: NextBestAction) => {
    if (actions.length < 3 && !added.has(action.id)) {
      actions.push(action);
      added.add(action.id);
    }
  };

  const outcome = (input.lastOutcomeStatus ?? "").toLowerCase();

  if (outcome === "rejected") {
    add({
      id: "start-new-application",
      label: "Create new application",
      why: "Keep momentum after a rejection.",
      href: "/app/applications/new",
    });
    add({
      id: "add-evidence",
      label: "Strengthen evidence",
      why: "Tighten fit before the next application.",
      href: `/app/applications/${applicationId}?tab=evidence#role-fit`,
    });
  }

  if (outcome === "offer") {
    add({
      id: "offer-complete",
      label: "Complete offer details",
      why: "Capture numbers to generate negotiation scripts.",
      href: `/app/applications/${applicationId}?tab=overview#offer-pack`,
    });
    add({
      id: "offer-negotiate",
      label: "Send negotiation message",
      why: "Use the offer pack variants to respond confidently.",
      href: `/app/applications/${applicationId}?tab=overview#offer-pack`,
    });
    add({
      id: "offer-decision",
      label: "Log decision",
      why: "Record accept/decline/ask for time to keep the pipeline tidy.",
      href: `/app/applications/${applicationId}?tab=overview#offer-pack`,
    });
  }

  if (outcome === "no_response") {
    add({
      id: "send-followup",
      label: "Send follow-up",
      why: "No response yet — nudge again.",
      href: `/app/applications/${applicationId}?tab=activity#outreach`,
    });
  }

  if (!input.closingDate) {
    add({
      id: "set-closing-date",
      label: "Set closing date",
      why: "Deadlines anchor your follow-ups.",
      href: `/app/applications/${applicationId}?tab=apply#smart-apply`,
    });
  }

  if ((input.pendingApplyItems ?? 0) > 0) {
    add({
      id: "complete-checklist",
      label: "Complete submission checklist",
      why: "Pending items block a ready-to-submit kit.",
      href: `/app/applications/${applicationId}?tab=apply#apply-checklist`,
    });
  }

  if (input.isSubmitted && !input.outcomeRecorded) {
    add({
      id: "record-outcome",
      label: "Record outcome",
      why: "Track responses to learn what works.",
      href: `/app/applications/${applicationId}?tab=overview#outcome`,
    });
  }

  const jobTextBlocked =
    input.jobTextStatus === "blocked" || input.jobTextStatus === "failed";
  const jobTextMissing = !input.hasJobText;
  if (jobTextBlocked || jobTextMissing) {
    add({
      id: "paste-job-text",
      label: "Paste job advert text",
      why: jobTextBlocked
        ? "Blocked fetch; paste the advert to keep Role Fit accurate."
        : "Add the advert text to tailor evidence.",
      href: `/app/applications/${applicationId}?tab=overview#job-advert`,
    });
  }

  if ((input.roleFitGaps ?? 0) > 0) {
    add({
      id: "add-evidence",
      label: "Add evidence for top gap",
      why: "Evidence closes gaps and improves exports.",
      href: `/app/applications/${applicationId}?tab=evidence#role-fit`,
    });
  }

  if (!input.starDraftCount || input.starDraftCount === 0) {
    add({
      id: "create-star",
      label: "Create a STAR draft",
      why: "STAR drafts feed interviews and Answer Pack.",
      href: `/app/applications/${applicationId}?tab=evidence#star-library`,
    });
  }

  const practiceNeedsWork =
    (input.practiceTotal ?? 0) > 0 &&
    (input.practiceScored ?? 0) < (input.practiceTotal ?? 0);
  if (practiceNeedsWork) {
    add({
      id: "practice-weakest",
      label: "Practise weakest question",
      why: "Raise interview readiness quickly.",
      href: `/app/applications/${applicationId}?tab=interview#practice-dashboard`,
    });
  }

  if (outcome === "interview_scheduled") {
    add({
      id: "interview-focus",
      label: "Start interview focus",
      why: "Prep focused answers before the interview.",
      href: `/app/applications/${applicationId}?tab=interview#interview-pack`,
    });
  }

  if (input.hasDueFollowup) {
    add({
      id: "send-followup",
      label: "Send follow-up",
      why: "A due follow-up keeps momentum.",
      href: `/app/applications/${applicationId}?tab=activity#followup`,
    });
  }

  return actions.slice(0, 3);
}
