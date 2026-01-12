type ChecklistItem = {
  label: string;
  ok: boolean;
  hint?: string;
};

type SubmissionChecklistProps = {
  items: ChecklistItem[];
};

export default function SubmissionChecklist({
  items,
}: SubmissionChecklistProps) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
        Submission checklist
      </p>
      <div className="mt-3 space-y-2 text-sm text-[rgb(var(--ink))]">
        {items.map((item) => (
          <div key={item.label} className="flex items-start gap-2">
            <span
              className={`mt-1 inline-flex h-2.5 w-2.5 rounded-full ${
                item.ok ? "bg-emerald-500" : "bg-amber-400"
              }`}
              aria-hidden
            />
            <div>
              <p className={item.ok ? "" : "text-amber-700"}>
                {item.label}
              </p>
              {item.hint ? (
                <p className="text-xs text-[rgb(var(--muted))]">
                  {item.hint}
                </p>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
