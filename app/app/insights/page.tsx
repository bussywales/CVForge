import Link from "next/link";
import Section from "@/components/Section";
import { getSupabaseUser } from "@/lib/data/supabase";
import { getInsightsSummary } from "@/lib/insights";

export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  const { supabase, user } = await getSupabaseUser();

  if (!user) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        Your session expired. Please sign in again.
      </div>
    );
  }

  const summary = await getInsightsSummary(supabase, user.id);

  return (
    <div className="space-y-6">
      <Link href="/app" className="text-sm text-[rgb(var(--muted))]">
        ← Back to dashboard
      </Link>

      <Section
        title="Today"
        description="Top actions across your applications."
      >
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
