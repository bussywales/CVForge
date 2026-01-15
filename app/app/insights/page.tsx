import Link from "next/link";
import Section from "@/components/Section";
import { getSupabaseUser } from "@/lib/data/supabase";
import { getInsightsSummary } from "@/lib/insights";
import OnboardingPanel from "./onboarding-panel";
import { computeOnboardingSteps } from "@/lib/onboarding";
import { createServerClient } from "@/lib/supabase/server";
import { createApplicationAction } from "../applications/actions";
import CoachModePanel from "./coach-mode-panel";
import {
  computeWeeklyTargets,
  detectWeakestStep,
  pickCoachActions,
} from "@/lib/coach-mode";
import { getEffectiveJobText } from "@/lib/job-text";
import { normalizeSelectedEvidence } from "@/lib/evidence";
import { getUserCredits } from "@/lib/data/credits";
import PackSelector from "@/app/app/billing/pack-selector";

export const dynamic = "force-dynamic";

export default async function InsightsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[]>;
}) {
  const { supabase, user } = await getSupabaseUser();

  if (!user) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        Your session expired. Please sign in again.
      </div>
    );
  }

  const summary = await getInsightsSummary(supabase, user.id);

  // Onboarding counts
  const counts = {
    achievements: 0,
    workHistory: 0,
    applications: 0,
  };
  let latestApplicationId: string | null = null;

  try {
    const { count, error } = await supabase
      .from("achievements")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    if (!error) counts.achievements = count ?? 0;
  } catch (error) {
    console.error("[insights.onboarding.achievements]", error);
  }

  try {
    const { count, error } = await supabase
      .from("work_history")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    if (!error) counts.workHistory = count ?? 0;
  } catch (error) {
    console.error("[insights.onboarding.work_history]", error);
  }

  try {
    const { count, data, error } = await supabase
      .from("applications")
      .select("*", { count: "exact" })
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1);
    if (!error) {
      counts.applications = count ?? 0;
      latestApplicationId = data?.[0]?.id ?? null;
    }
  } catch (error) {
    console.error("[insights.onboarding.applications]", error);
  }

  const onboarding = computeOnboardingSteps({
    achievementsCount: counts.achievements,
    workHistoryCount: counts.workHistory,
    applicationsCount: counts.applications,
    latestApplicationId,
  });
  const credits = await getUserCredits(supabase, user.id);

  const handleCreateSample = async () => {
    "use server";
    const client = createServerClient();
    const {
      data: { user: current },
    } = await client.auth.getUser();
    if (!current) {
      return;
    }
    const formData = new FormData();
    formData.set("job_title", "Sample Role");
    formData.set("company", "Demo Company");
    formData.set(
      "job_description",
      "We need someone to improve reliability, deliver features, and communicate with stakeholders."
    );
    formData.set("status", "draft");
    await createApplicationAction(formData);
  };

  // Coach mode data
  let followupsThisWeek = 0;
  let submissionsThisWeek = 0;
  let starThisWeek = 0;
  let practiceThisWeek: number | null = null;
  let overdueAppId: string | null = null;
  let missingJobCount = 0;
  let missingJobApp: string | null = null;
  let evidenceLowCount = 0;
  let evidenceApp: string | null = null;
  let starMissingCount = 0;
  let starApp: string | null = null;

  const { start, end } = (() => {
    const now = new Date();
    const weekStart = new Date(now);
    const day = weekStart.getDay();
    const diff = (day === 0 ? -6 : 1) - day;
    weekStart.setDate(weekStart.getDate() + diff);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);
    return { start: weekStart, end: weekEnd };
  })();

  try {
    const { data, error } = await supabase
      .from("application_activities")
      .select("application_id,type,occurred_at")
      .eq("user_id", user.id)
      .gte("occurred_at", start.toISOString())
      .lt("occurred_at", end.toISOString());
    if (!error && data) {
      data.forEach((row) => {
        if (
          ["followup.sent", "followup.logged", "outreach.sent", "outreach.logged"].includes(
            row.type ?? ""
          )
        ) {
          followupsThisWeek += 1;
        }
        if (row.type === "apply.submitted") {
          submissionsThisWeek += 1;
        }
      });
    }
  } catch (error) {
    console.error("[coach.activities]", error);
  }

  try {
    const { count, error } = await supabase
      .from("star_library")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", start.toISOString())
      .lt("created_at", end.toISOString());
    if (!error) starThisWeek = count ?? 0;
  } catch (error) {
    console.error("[coach.star]", error);
  }

  try {
    const { count, error } = await supabase
      .from("interview_practice_answers")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", start.toISOString())
      .lt("created_at", end.toISOString());
    if (!error) practiceThisWeek = count ?? 0;
  } catch (error) {
    // table may not exist
  }

  try {
    const { data, error } = await supabase
      .from("applications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    if (!error && data) {
      data.forEach((app: any) => {
        const jobText = getEffectiveJobText(app as any);
        if (jobText.trim().length < 200 && !missingJobApp) {
          missingJobApp = app.id;
          missingJobCount += 1;
        }
        if (
          app.next_action_due &&
          new Date(app.next_action_due).getTime() <= new Date().getTime() &&
          !overdueAppId
        ) {
          overdueAppId = app.id;
        }
        const selectedEvidence = normalizeSelectedEvidence(app.selected_evidence);
        if (selectedEvidence.length === 0 && !evidenceApp) {
          evidenceApp = app.id;
          evidenceLowCount += 1;
        }
        const hasStar =
          Array.isArray(app.star_drafts) && (app.star_drafts as any[]).length > 0;
        if (!hasStar && !starApp) {
          starApp = app.id;
          starMissingCount += 1;
        }
      });
    }
  } catch (error) {
    console.error("[coach.applications]", error);
  }

  const weeklyTargets = computeWeeklyTargets({
    followups: followupsThisWeek,
    submissions: submissionsThisWeek,
    starDrafts: starThisWeek,
    practice: practiceThisWeek ?? null,
  });

  const weakest = detectWeakestStep({
    overdueFollowups: overdueAppId ? 1 : 0,
    missingJobDetails: missingJobCount,
    lowEvidence: evidenceLowCount,
    missingStar: starMissingCount,
    firstOverdueApp: overdueAppId,
    firstMissingJobApp: missingJobApp,
    firstEvidenceApp: evidenceApp,
    firstStarApp: starApp,
  });

  const coachActions = pickCoachActions({
    overdueAppId,
    starAppId: starApp,
    latestAppId: latestApplicationId,
  });

  const coachMessage = (() => {
    const params = new URLSearchParams(
      Object.entries(searchParams ?? {}).flatMap(([key, value]) =>
        Array.isArray(value) ? value.map((v) => [key, v]) : [[key, value]]
      )
    );
    const flag = params.get("coach");
    if (!flag) return null;
    if (flag === "scheduled") return "Follow-up scheduled";
    if (flag === "star_created") return "STAR draft created";
    if (flag === "missing_app") return "Pick an application to coach";
    if (flag === "error") return "Coach action failed. Try again.";
    return null;
  })();

  return (
    <div className="space-y-6">
      <Link href="/app" className="text-sm text-[rgb(var(--muted))]">
        ← Back to dashboard
      </Link>
      {credits <= 0 ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-800">
            Top up credits to run packs and kits.
          </p>
          <div className="mt-2">
            <PackSelector
              contextLabel="Continue your Coach plan"
              returnTo="/app/insights"
              compact
            />
          </div>
        </div>
      ) : null}

      <Section
        title="Today"
        description="Top actions across your applications."
      >
        <CoachModePanel
          weeklyTargets={weeklyTargets}
          weakest={weakest}
          coachActions={coachActions}
          coachMessage={coachMessage}
        />
        <div className="mb-4">
          <OnboardingPanel
            steps={onboarding.steps}
            completed={onboarding.completed}
            total={onboarding.total}
            hasApplications={counts.applications > 0}
            onCreateSample={counts.applications === 0 ? handleCreateSample : undefined}
          />
        </div>
        <div className="space-y-3">
          {summary.topActions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-black/10 bg-white/60 p-4 text-sm text-[rgb(var(--muted))]">
              All set. Review your Application Kit or pipeline.
            </div>
          ) : (
            summary.topActions.map((action) => (
              <div
                key={action.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white/70 p-4"
              >
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
                    {action.role} · {action.company}
                  </p>
                  <p className="text-sm font-semibold text-[rgb(var(--ink))]">
                    {action.label}
                  </p>
                  <p className="text-xs text-[rgb(var(--muted))]">{action.why}</p>
                </div>
                <Link
                  href={action.href}
                  className="rounded-full border border-black/10 bg-[rgb(var(--ink))] px-4 py-2 text-sm font-semibold text-white hover:bg-black"
                >
                  Go
                </Link>
              </div>
            ))
          )}
          <Link
            href="/app/pipeline"
            className="text-xs font-semibold text-[rgb(var(--ink))] underline-offset-2 hover:underline"
          >
            View all due follow-ups in Pipeline →
          </Link>
        </div>
      </Section>

      <Section
        title="Pipeline funnel"
        description="Submission and outcome signals (deterministic only)."
      >
        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
          {[
            { label: "Drafted", value: summary.funnel.drafted },
            { label: "Submitted", value: summary.funnel.submitted },
            { label: "Interview", value: summary.funnel.interview },
            { label: "Offers", value: summary.funnel.offer },
            { label: "Rejected", value: summary.funnel.rejected },
            { label: "No response", value: summary.funnel.noResponse },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-black/10 bg-white/70 p-4"
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
        <div className="mt-3 rounded-2xl border border-black/10 bg-white/70 p-4 text-sm text-[rgb(var(--muted))]">
          Response rate:{" "}
          <span className="font-semibold text-[rgb(var(--ink))]">
            {summary.funnel.responseRate}%
          </span>
          . Interviews / Submitted.
        </div>
      </Section>

      <Section
        title="Behaviour insights"
        description="Deterministic patterns (last 90 days)."
      >
        <div className="space-y-2">
          {summary.correlations.map((item, idx) => (
            <div
              key={idx}
              className="rounded-2xl border border-black/10 bg-white/70 p-4 text-sm text-[rgb(var(--muted))]"
            >
              {item.text}
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
