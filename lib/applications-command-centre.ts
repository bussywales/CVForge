import {
  applicationStatusLabels,
  normaliseApplicationStatus,
} from "@/lib/application-status";
import { buildNextBestActions } from "@/lib/next-best-actions";
import { formatRelativeTime } from "@/lib/tracking-utils";
import { getEffectiveJobText } from "@/lib/job-text";
import type { ApplicationRecord } from "@/lib/data/applications";

export type CommandCentreItem = {
  id: string;
  title: string;
  company: string;
  status: string;
  statusLabel: string;
  statusCategory: "draft" | "submitted" | "interview" | "closed" | "other";
  nextActionLabel: string;
  nextActionHref: string;
  progressLabel: string;
  followupDue: boolean;
  updatedLabel: string;
  updatedTs: number;
  urgencyRank: number;
};

type CountMaps = {
  evidence: Record<string, number>;
  star: Record<string, number>;
  autopack: Record<string, number>;
};

export function buildCommandCentreItems(
  applications: ApplicationRecord[],
  counts: CountMaps
): CommandCentreItem[] {
  const now = Date.now();

  const items = applications.map((app) => {
    const status = normaliseApplicationStatus(app.status);
    const statusStr = String(status);
    const statusLabel =
      applicationStatusLabels[
        statusStr as keyof typeof applicationStatusLabels
      ] ?? statusStr;
    const statusCategory = deriveStatusCategory(statusStr);

    const evidenceCount = counts.evidence[app.id] ?? 0;
    const starCount = counts.star[app.id] ?? 0;
    const autopackCount = counts.autopack[app.id] ?? 0;

    const jobText = getEffectiveJobText(app);
    const hasJobText = jobText.trim().length > 0;
    const hasEvidence = evidenceCount > 0;
    const hasStar = starCount > 0;
    const hasAutopack = autopackCount > 0;
    const submitted =
      statusStr === "submitted" ||
      statusStr === "applied" ||
      Boolean(app.submitted_at);
    const followupScheduled =
      Boolean(app.next_action_due) || Boolean(app.next_followup_at);

    const readiness =
      Number(hasJobText) +
      Number(hasEvidence) +
      Number(hasStar) +
      Number(hasAutopack) +
      Number(submitted || followupScheduled);

    const nextActions = buildNextBestActions({
      applicationId: app.id,
      jobTextStatus: app.job_fetch_status,
      hasJobText,
      roleFitGaps: hasEvidence ? 0 : 1,
      starDraftCount: starCount,
      hasDueFollowup: followupScheduled && isPast(app.next_action_due ?? app.next_followup_at),
      isSubmitted: submitted,
      outcomeRecorded: Boolean(app.last_outcome_status),
    });

    const next = nextActions[0] ?? {
      id: "open",
      label: "Open application",
      why: "",
      href: `/app/applications/${app.id}?tab=overview`,
    };

    const updatedSource =
      app.updated_at ?? app.last_activity_at ?? app.last_touch_at ?? app.created_at;
    const updatedTs = updatedSource ? new Date(updatedSource).getTime() : 0;
    const updatedLabel = updatedSource ? formatRelativeTime(updatedSource) : "—";

    const urgencyRank = computeUrgency({
      status,
      hasJobText,
      hasEvidence,
      hasAutopack,
      nextActionDue: app.next_action_due,
      nextFollowupAt: app.next_followup_at,
    });

    const followupDue = isPast(app.next_action_due ?? app.next_followup_at);

    return {
      id: app.id,
      title: app.job_title,
      company: app.company_name ?? app.company ?? "—",
      status: statusStr,
      statusLabel,
      statusCategory,
      nextActionLabel: next.label,
      nextActionHref: next.href,
      progressLabel: `Ready: ${readiness}/5`,
      followupDue,
      updatedLabel,
      updatedTs,
      urgencyRank,
    };
  });

  return items.sort((a, b) => {
    if (a.urgencyRank !== b.urgencyRank) {
      return a.urgencyRank - b.urgencyRank;
    }
    return b.updatedTs - a.updatedTs;
  });
}

function deriveStatusCategory(
  status: string
): "draft" | "submitted" | "interview" | "closed" | "other" {
  const statusStr = String(status);
  if (
    statusStr === "draft" ||
    statusStr === "ready" ||
    statusStr === "applied"
  )
    return "draft";
  if (statusStr === "submitted") return "submitted";
  if (statusStr.includes("interview")) return "interview";
  if (
    statusStr === "offer" ||
    statusStr === "accepted" ||
    statusStr === "rejected" ||
    statusStr === "withdrawn" ||
    statusStr === "closed"
  )
    return "closed";
  return "other";
}

function isPast(value?: string | null) {
  if (!value) return false;
  return new Date(value).getTime() <= Date.now();
}

function computeUrgency(input: {
  status: string;
  hasJobText: boolean;
  hasEvidence: boolean;
  hasAutopack: boolean;
  nextActionDue?: string | null;
  nextFollowupAt?: string | null;
}) {
  const statusStr = String(input.status);
  const followupDue = isPast(input.nextActionDue ?? input.nextFollowupAt);
  if (followupDue) return 0;
  if (statusStr === "submitted" && !input.nextActionDue && !input.nextFollowupAt)
    return 1;
  if (statusStr === "draft" && !input.hasJobText) return 2;
  if (statusStr === "draft" && !input.hasEvidence) return 3;
  if (statusStr === "draft" && !input.hasAutopack) return 4;
  if (statusStr.includes("interview")) return 5;
  return 6;
}
