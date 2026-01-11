export default function ProfilePage() {
  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-black/10 bg-white/80 p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Profile</h1>
        <p className="mt-2 text-sm text-[rgb(var(--muted))]">
          Store your core story, headline, and location here.
        </p>
      </div>
      <div className="rounded-2xl border border-dashed border-black/20 bg-white/60 p-6 text-sm text-[rgb(var(--muted))]">
        Profile editing UI ships in Phase 1.
      </div>
    </div>
  );
}
