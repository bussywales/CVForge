import type { ApplicationRecord } from "@/lib/data/applications";
import type { InsightTopAction } from "@/lib/insights";

export type DashboardAction = {
  id: string;
  label: string;
  why: string;
  href: string;
  badge?: string;
  applicationId: string;
};

export function buildDashboardActions(
  actions: InsightTopAction[],
  limit = 5
): DashboardAction[] {
  const ordered = [...actions].sort((a, b) => a.priority - b.priority);
  const seen = new Set<string>();
  const deduped: InsightTopAction[] = [];

  const actionKey = (action: InsightTopAction) => {
    if (action.id.startsWith("followup")) return "followup";
    if (action.id.startsWith("jobtext")) return "jobtext";
    if (action.id.startsWith("evidence")) return "evidence";
    if (action.id.startsWith("star")) return "star";
    if (action.id.startsWith("practice")) return "practice";
    return action.id;
  };

  for (const action of ordered) {
    const key = actionKey(action);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(action);
    if (deduped.length >= limit) break;
  }

  return deduped.slice(0, limit).map((action) => ({
    id: action.id,
    label: action.label,
    why: action.why,
    href: action.href,
    applicationId: action.applicationId,
    badge: action.href.includes("tab=apply")
      ? "Apply"
      : action.href.includes("tab=evidence")
        ? "Evidence"
        : action.href.includes("tab=interview")
          ? "Interview"
          : action.href.includes("tab=activity")
            ? "Activity"
            : undefined,
  }));
}

export type DashboardApplication = {
  id: string;
  role: string;
  company: string;
  status: string;
  nextActionDue: string | null;
  href: string;
};

export function selectActiveApplications(
  applications: ApplicationRecord[],
  limit = 5
): DashboardApplication[] {
  const sorted = applications
    .filter((app) => (app.status ?? "").toString().toLowerCase() !== "archived")
    .sort((a, b) => {
      const aDate = a.last_activity_at ?? a.updated_at ?? a.created_at;
      const bDate = b.last_activity_at ?? b.updated_at ?? b.created_at;
      return (bDate ?? "").localeCompare(aDate ?? "");
    });

  return sorted.slice(0, limit).map((app) => ({
    id: app.id,
    role: app.job_title ?? "Untitled role",
    company: app.company_name ?? app.company ?? "—",
    status: app.status ?? "draft",
    nextActionDue: app.next_action_due ?? null,
    href: `/app/applications/${app.id}?tab=apply#smart-apply`,
  }));
}
