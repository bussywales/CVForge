export default function ApplicationsPage() {
  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-black/10 bg-white/80 p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Applications</h1>
        <p className="mt-2 text-sm text-[rgb(var(--muted))]">
          Track every job target, status update, and CV iteration.
        </p>
      </div>
      <div className="rounded-2xl border border-dashed border-black/20 bg-white/60 p-6 text-sm text-[rgb(var(--muted))]">
        Application tracking tables arrive in Phase 1.
      </div>
    </div>
  );
}
