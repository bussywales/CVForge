import Link from "next/link";
import { redirect } from "next/navigation";
import Section from "@/components/Section";
import { getUserCredits } from "@/lib/data/credits";
import { createServerClient } from "@/lib/supabase/server";
import { listApplications, type ApplicationRecord } from "@/lib/data/applications";
import { getInsightsSummary } from "@/lib/insights";
import { buildDashboardActions, selectActiveApplications } from "@/lib/dashboard";
import { detectWeakestStep } from "@/lib/coach-mode";
import TelemetryBanner from "./telemetry-banner";

export const dynamic = "force-dynamic";

function formatDue(date: string | null) {
  if (!date) return "—";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default async function AppPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  let credits = 0;
  let telemetryOptIn = false;
  let applications: ApplicationRecord[] = [];

  try {
    credits = await getUserCredits(supabase, user.id);
  } catch (error) {
    console.error("[dashboard credits]", error);
  }

  try {
    applications = await listApplications(supabase, user.id);
  } catch (error) {
    console.error("[dashboard applications]", error);
  }

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("telemetry_opt_in")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    telemetryOptIn = Boolean(data?.telemetry_opt_in);
  } catch (error) {
    console.error("[dashboard telemetry]", error);
  }

  const insights = await getInsightsSummary(supabase, user.id);
  const actions = buildDashboardActions(insights.topActions, 5);
  const activeApps = selectActiveApplications(applications as any, 5);

  const overdueFollowups = (applications as any[]).filter((app) => {
    const due = app.next_action_due as string | null;
    if (!due) return false;
    const parsed = new Date(due);
    if (Number.isNaN(parsed.getTime())) return false;
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
    const dueKey = `${parsed.getFullYear()}-${parsed.getMonth()}-${parsed.getDate()}`;
    return dueKey <= todayKey;
  });

  const missingJobDetails = (applications as any[]).filter((app) => {
    const jobText = (app.job_text ?? app.job_description ?? "") as string;
    return jobText.trim().length < 200;
  });

  const lowEvidence = (applications as any[]).filter((app) => {
    const selected =
      Array.isArray(app.selected_evidence) || typeof app.selected_evidence === "object"
        ? app.selected_evidence
        : [];
    return (selected as any[]).length === 0;
  });

  const missingStar = (applications as any[]).filter((app) => {
    const drafts = Array.isArray(app.star_drafts) ? app.star_drafts : [];
    return drafts.length === 0;
  });

  const weakest = detectWeakestStep({
    overdueFollowups: overdueFollowups.length,
    missingJobDetails: missingJobDetails.length,
    lowEvidence: lowEvidence.length,
    missingStar: missingStar.length,
    firstOverdueApp: overdueFollowups[0]?.id ?? null,
    firstMissingJobApp: missingJobDetails[0]?.id ?? null,
    firstEvidenceApp: lowEvidence[0]?.id ?? null,
    firstStarApp: missingStar[0]?.id ?? null,
  });

  const primaryCta =
    activeApps[0]?.href ?? "/app/applications/new";

  return (
    <div className="space-y-6">
      <TelemetryBanner telemetryOptIn={telemetryOptIn} />

      <Section
        title={`Welcome back${user?.email ? `, ${user.email}` : ""}.`}
        description="Your Activation Command Centre: next actions, live applications, coaching, and funnel at a glance."
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="text-sm text-[rgb(var(--muted))]">
            You’re {Math.max(actions.length, 1)} actions away from your next submission.
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-[rgb(var(--ink))] shadow-sm">
              Credits: {credits}
            </span>
            <Link
              href={primaryCta}
              className="rounded-full bg-[rgb(var(--accent))] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[rgb(var(--accent-strong))]"
            >
              {activeApps.length > 0 ? "Continue" : "Create application"}
            </Link>
          </div>
        </div>
      </Section>

      <Section
        title="Next best actions"
        description="Up to five moves to unblock your next submission."
      >
        {actions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-black/10 bg-white/70 p-4 text-sm text-[rgb(var(--muted))]">
            No actions yet. Create your first application to get started.
          </div>
        ) : (
          <div className="space-y-3">
            {actions.map((action) => (
              <div
                key={action.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white/80 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-[rgb(var(--ink))]">
                    {action.label}
                  </p>
                  <p className="text-xs text-[rgb(var(--muted))]">{action.why}</p>
                </div>
                <div className="flex items-center gap-3">
                  {action.badge ? (
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-700">
                      {action.badge}
                    </span>
                  ) : null}
                  <Link
                    href={action.href}
                    className="rounded-full border border-black/10 bg-[rgb(var(--accent))] px-3 py-2 text-xs font-semibold text-white hover:bg-[rgb(var(--accent-strong))]"
                  >
                    Go
                  </Link>
                </div>
              </div>
            ))}
            <Link
              href="/app/applications"
              className="text-sm font-semibold text-[rgb(var(--accent-strong))] underline-offset-4 hover:underline"
            >
              See all
            </Link>
          </div>
        )}
      </Section>

      <Section
        title="Active applications"
        description="Latest roles you’re working on."
      >
        {activeApps.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-black/10 bg-white/70 p-4 text-sm text-[rgb(var(--muted))]">
            No applications yet. Create one to start your flow.
          </div>
        ) : (
          <div className="space-y-3">
            {activeApps.map((app) => (
              <div
                key={app.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white/80 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-[rgb(var(--ink))]">
                    {app.role}
                  </p>
                  <p className="text-xs text-[rgb(var(--muted))]">
                    {app.company} · Status: {app.status}
                  </p>
                  <p className="text-[11px] text-[rgb(var(--muted))]">
                    Next action: {formatDue(app.nextActionDue)}
                  </p>
                </div>
                <Link
                  href={app.href}
                  className="rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-[rgb(var(--ink))] hover:border-black/20"
                >
                  Continue
                </Link>
              </div>
            ))}
          </div>
        )}
      </Section>

      <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
        <Section
          title="Coach nudge"
          description="Weakest step based on your current applications."
        >
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white/80 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-[rgb(var(--ink))]">
                {weakest.title}
              </p>
              <p className="text-xs text-[rgb(var(--muted))]">{weakest.detail}</p>
            </div>
            <Link
              href={weakest.href}
              className="rounded-full bg-[rgb(var(--accent))] px-3 py-2 text-xs font-semibold text-white hover:bg-[rgb(var(--accent-strong))]"
            >
              Fix this now
            </Link>
          </div>
          <p className="mt-2 text-xs text-[rgb(var(--muted))]">
            Want deeper coaching? Visit Coach Mode on Insights.
          </p>
        </Section>

        <Section
          title="Funnel snapshot"
          description="7d/30d submission signals"
        >
          <div className="grid gap-3 md:grid-cols-2">
            {[
              { label: "Drafted", value: insights.funnel.drafted },
              { label: "Submitted", value: insights.funnel.submitted },
              { label: "Interview", value: insights.funnel.interview },
              { label: "Offer", value: insights.funnel.offer },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-black/10 bg-white/80 p-4"
              >
                <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
                  {item.label}
                </p>
                <p className="text-2xl font-semibold text-[rgb(var(--ink))]">
                  {item.value}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-3 text-xs text-[rgb(var(--muted))]">
            Response rate: {insights.funnel.responseRate}% ·{" "}
            <Link
              href="/app/insights"
              className="font-semibold text-[rgb(var(--accent-strong))] underline-offset-4 hover:underline"
            >
              Open Insights
            </Link>
          </div>
        </Section>
      </div>
    </div>
  );
}
