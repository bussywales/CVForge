type SubmissionQualityProps = {
  keywordCoveragePct: number;
  keywordMatched: number;
  keywordTotal: number;
  metricCount: number;
  bulletCount: number;
  longBullets: number;
  hasExperience: boolean;
  hasSkills: boolean;
  hasPlaceholders: boolean;
  coverOk: boolean;
  coverHint?: string;
};

export default function SubmissionQuality({
  keywordCoveragePct,
  keywordMatched,
  keywordTotal,
  metricCount,
  bulletCount,
  longBullets,
  hasExperience,
  hasSkills,
  hasPlaceholders,
  coverOk,
  coverHint,
}: SubmissionQualityProps) {
  const sectionsOk = hasExperience && hasSkills;
  const coverageOk = keywordTotal === 0 ? false : keywordCoveragePct >= 30;
  const metricsOk = bulletCount === 0 ? false : metricCount >= 1;

  const items = [
    {
      label: "Keywords coverage",
      value:
        keywordTotal === 0
          ? "No job description terms found"
          : `${keywordCoveragePct}% (${keywordMatched}/${keywordTotal})`,
      ok: coverageOk,
      hint: keywordTotal === 0 ? "Paste a fuller job description." : undefined,
    },
    {
      label: "Metrics present",
      value: bulletCount
        ? `${metricCount} of ${bulletCount} bullets`
        : "No bullets detected",
      ok: metricsOk,
      hint: bulletCount === 0 ? "Add bullet points to your CV." : undefined,
    },
    {
      label: "Cover letter alignment",
      value: coverOk ? "Role/company referenced" : "Missing in opening paragraph",
      ok: coverOk,
      hint: coverOk ? undefined : coverHint,
    },
    {
      label: "Bullet length sanity",
      value: longBullets > 0 ? `${longBullets} bullets > 240 chars` : "All bullets concise",
      ok: longBullets === 0,
      hint: longBullets > 0 ? "Split long bullets into shorter statements." : undefined,
    },
    {
      label: "Core CV sections",
      value: sectionsOk
        ? "Experience + Skills included"
        : `${hasExperience ? "" : "Experience"}${!hasExperience && !hasSkills ? " + " : ""}${hasSkills ? "" : "Skills"} missing`,
      ok: sectionsOk,
      hint: sectionsOk ? undefined : "Add the missing headings to your CV.",
    },
    {
      label: "Placeholders",
      value: hasPlaceholders ? "Placeholders detected" : "No placeholders found",
      ok: !hasPlaceholders,
      hint: hasPlaceholders
        ? "Remove placeholder tokens or draft notes before export."
        : undefined,
    },
  ];

  return (
    <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
            Submission quality
          </p>
          <p className="mt-1 text-xs text-[rgb(var(--muted))]">
            Quick checks to make the pack submission-ready.
          </p>
        </div>
        <span className="text-xs text-[rgb(var(--muted))]">
          Deterministic checks
        </span>
      </div>
      <div className="mt-4 space-y-3 text-sm text-[rgb(var(--ink))]">
        {items.map((item) => (
          <div key={item.label} className="flex items-start gap-3">
            <span
              className={`mt-1 inline-flex h-2.5 w-2.5 rounded-full ${
                item.ok ? "bg-emerald-500" : "bg-amber-400"
              }`}
              aria-hidden
            />
            <div className="flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className={item.ok ? "" : "text-amber-700"}>{item.label}</p>
                <span className="text-xs text-[rgb(var(--muted))]">
                  {item.value}
                </span>
              </div>
              {item.hint ? (
                <p className="text-xs text-[rgb(var(--muted))]">{item.hint}</p>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
