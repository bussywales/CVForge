import Section from "@/components/Section";
import { listApplications } from "@/lib/data/applications";
import { listLatestActivities } from "@/lib/data/application-activities";
import { getSupabaseUser } from "@/lib/data/supabase";
import {
  applicationStatusLabels,
  applicationStatusOptions,
  normaliseApplicationStatus,
} from "@/lib/application-status";
import { deriveNeedsFollowUp, isDueToday, isOverdue } from "@/lib/tracking-utils";
import { updateTrackingAction } from "../applications/actions";
import PipelineBoard from "./pipeline-board";

export const dynamic = "force-dynamic";

type InsightItem = {
  label: string;
  value: number;
};

export default async function PipelinePage() {
  const { supabase, user } = await getSupabaseUser();

  if (!user) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        Your session expired. Please sign in again.
      </div>
    );
  }

  let applications = [];
  try {
    applications = await listApplications(supabase, user.id);
  } catch (error) {
    console.error("[pipeline.applications]", error);
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        Unable to load applications right now. Please refresh or try again.
      </div>
    );
  }
  let lastActivityById: Record<string, string> = {};
  try {
    const activitySummaries = await listLatestActivities(
      supabase,
      user.id,
      applications.map((application) => application.id)
    );
    lastActivityById = activitySummaries.reduce(
      (acc, activity) => {
        if (!acc[activity.application_id]) {
          acc[activity.application_id] = activity.occurred_at;
        }
        return acc;
      },
      {} as Record<string, string>
    );
  } catch (error) {
    console.error("[pipeline.activities]", error);
  }

  const counts = applications.reduce(
    (acc, app) => {
      const status = normaliseApplicationStatus(app.status);
      acc.total += 1;
      acc.byStatus[status] = (acc.byStatus[status] ?? 0) + 1;
      if (deriveNeedsFollowUp(status, app.next_action_due)) {
        acc.needsFollowup += 1;
      }
      if (isDueToday(app.next_action_due)) {
        acc.dueToday += 1;
      }
      if (isOverdue(app.next_action_due)) {
        acc.overdue += 1;
      }
      return acc;
    },
    {
      total: 0,
      needsFollowup: 0,
      dueToday: 0,
      overdue: 0,
      byStatus: {} as Record<string, number>,
    }
  );

  const insightItems: InsightItem[] = [
    { label: "Total", value: counts.total },
    { label: "Applied", value: counts.byStatus.applied ?? 0 },
    { label: "Interviewing", value: counts.byStatus.interviewing ?? 0 },
    { label: "Offers", value: counts.byStatus.offer ?? 0 },
    { label: "Rejected", value: counts.byStatus.rejected ?? 0 },
    { label: "Needs follow-up", value: counts.needsFollowup },
  ];

  return (
    <Section
      title="Pipeline"
      description="Track where each application sits and stay ahead of follow-ups."
    >
      <div className="space-y-6">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          {insightItems.map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-black/10 bg-white/80 p-4"
            >
              <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
                {item.label}
              </p>
              <p className="mt-2 text-2xl font-semibold text-[rgb(var(--ink))]">
                {item.value}
              </p>
            </div>
          ))}
        </div>

        <PipelineBoard
          applications={applications}
          lastActivityById={lastActivityById}
          onUpdateStatus={updateTrackingAction}
          dueTodayCount={counts.dueToday}
          overdueCount={counts.overdue}
        />

        <p className="text-xs text-[rgb(var(--muted))]">
          Status options: {applicationStatusOptions.map((opt) => applicationStatusLabels[opt.value]).join(", ")}.
        </p>
      </div>
    </Section>
  );
}
