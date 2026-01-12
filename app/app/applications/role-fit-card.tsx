import Section from "@/components/Section";
import type { RoleFitResult } from "@/lib/role-fit";

type RoleFitCardProps = {
  result: RoleFitResult;
  hasJobDescription: boolean;
  hasEvidence: boolean;
};

export default function RoleFitCard({
  result,
  hasJobDescription,
  hasEvidence,
}: RoleFitCardProps) {
  const guidance = !hasJobDescription
    ? "Add a job description to get a role-fit score."
    : result.totalWeight === 0
      ? "Add more detail to the job description to surface role-fit signals."
    : !hasEvidence
      ? "Add achievements or a profile headline to improve your score."
      : null;

  return (
    <Section
      title="Role fit"
      description="How closely your evidence matches the job description."
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-black/10 bg-white/70 p-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
              Role fit score
            </p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-semibold text-[rgb(var(--ink))]">
                {result.score}
              </span>
              <span className="text-sm text-[rgb(var(--muted))]">/ 100</span>
            </div>
            {hasJobDescription && result.totalWeight > 0 ? (
              <p className="mt-1 text-xs text-[rgb(var(--muted))]">
                Matched {result.matchedSignals.length} of {result.relevantCount} signals
              </p>
            ) : null}
          </div>
          <p className="max-w-xs text-xs text-[rgb(var(--muted))]">
            Heuristic score — improve by adding evidence in Achievements.
          </p>
        </div>

        {guidance ? (
          <div className="rounded-2xl border border-dashed border-black/10 bg-white/60 p-4 text-sm text-[rgb(var(--muted))]">
            {guidance}
          </div>
        ) : null}

        {hasJobDescription && result.totalWeight > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
                Matched signals
              </p>
              {result.matchedSignals.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {result.matchedSignals.map((signal) => (
                    <span
                      key={signal.id}
                      className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"
                    >
                      {signal.label}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-[rgb(var(--muted))]">
                  No matched signals yet. Add evidence in Achievements.
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
                Gaps to strengthen
              </p>
              {result.gapSignals.length ? (
                <div className="mt-3 space-y-4 text-sm text-[rgb(var(--ink))]">
                  {result.gapSignals.map((gap) => (
                    <div key={gap.id} className="space-y-2">
                      <div className="flex items-start gap-2">
                        <span
                          className="mt-2 h-1.5 w-1.5 rounded-full bg-amber-500"
                          aria-hidden
                        />
                        <span className="font-semibold">{gap.label}</span>
                      </div>
                      <ul className="space-y-1 text-xs text-[rgb(var(--muted))]">
                        {gap.suggestions.map((suggestion) => (
                          <li key={suggestion} className="flex gap-2">
                            <span className="mt-2 h-1 w-1 rounded-full bg-slate-300" aria-hidden />
                            <span>{suggestion}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-[rgb(var(--muted))]">
                  No gaps detected yet. Add more detail if needed.
                </p>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </Section>
  );
}
