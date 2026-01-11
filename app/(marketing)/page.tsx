import Link from "next/link";

const highlights = [
  {
    title: "Signal-first CVs",
    description: "Turn dense job descriptions into crisp, measurable achievements.",
  },
  {
    title: "Application packs",
    description: "Bundle CV, cover letter, and custom answers in one review flow.",
  },
  {
    title: "Audit-ready",
    description: "Track every iteration with a clean, immutable ledger.",
  },
];

export default function MarketingPage() {
  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute -left-24 top-24 h-72 w-72 rounded-full bg-[rgba(34,94,116,0.15)] blur-3xl" />
      <div className="pointer-events-none absolute -right-20 top-0 h-96 w-96 rounded-full bg-[rgba(191,111,75,0.18)] blur-[120px]" />
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-10">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[rgba(34,94,116,0.12)] text-lg font-semibold text-[rgb(var(--accent-strong))]">
              CV
            </span>
            <div className="text-lg font-semibold tracking-tight">CVForge</div>
          </div>
          <nav className="flex items-center gap-3 text-sm">
            <Link
              href="/login"
              className="rounded-full border border-black/10 px-4 py-2 transition hover:border-black/20"
            >
              Sign in
            </Link>
            <Link
              href="/app"
              className="rounded-full bg-[rgb(var(--accent))] px-4 py-2 font-medium text-white shadow-sm transition hover:bg-[rgb(var(--accent-strong))]"
            >
              Open app
            </Link>
          </nav>
        </header>

        <main className="mt-16 grid gap-12 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/70 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
              Phase 0
              <span className="h-1.5 w-1.5 rounded-full bg-[rgb(var(--accent))]" />
              SSR Auth + Stripe
            </div>
            <h1 className="mt-6 text-4xl font-semibold tracking-tight text-[rgb(var(--ink))] sm:text-5xl">
              Forge tailored CVs in minutes, not weekends.
            </h1>
            <p className="mt-4 max-w-xl text-lg text-[rgb(var(--muted))]">
              CVForge orchestrates your achievements, applications, and credits in one
              confident workspace. Build once, tune fast, ship every submission with
              clarity.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="/login"
                className="rounded-2xl bg-[rgb(var(--accent))] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-[rgba(34,94,116,0.25)] transition hover:bg-[rgb(var(--accent-strong))]"
              >
                Start with email magic link
              </Link>
              <Link
                href="/app"
                className="rounded-2xl border border-black/10 bg-white/70 px-6 py-3 text-sm font-semibold text-[rgb(var(--ink))] transition hover:border-black/20"
              >
                Preview dashboard
              </Link>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {highlights.map((highlight) => (
                <div
                  key={highlight.title}
                  className="rounded-2xl border border-black/10 bg-white/70 p-4 shadow-sm"
                >
                  <div className="text-sm font-semibold text-[rgb(var(--ink))]">
                    {highlight.title}
                  </div>
                  <p className="mt-2 text-sm text-[rgb(var(--muted))]">
                    {highlight.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute -left-6 top-10 h-24 w-24 rounded-full border border-black/10 bg-white/60 shadow" />
            <div className="absolute -right-6 bottom-8 h-16 w-16 rounded-2xl border border-black/10 bg-white/70 shadow" />
            <div className="relative rounded-3xl border border-black/10 bg-white/80 p-6 shadow-xl backdrop-blur">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
                    Activity Feed
                  </p>
                  <h2 className="mt-2 text-xl font-semibold">Applications in motion</h2>
                </div>
                <span className="rounded-full bg-[rgba(34,94,116,0.12)] px-3 py-1 text-xs font-semibold text-[rgb(var(--accent-strong))]">
                  7 active
                </span>
              </div>
              <div className="mt-6 space-y-4">
                {[
                  "Senior Product Designer — Visionary Labs",
                  "Growth PM — Atlas Finance",
                  "Design Lead — Northwind",
                ].map((item) => (
                  <div
                    key={item}
                    className="flex items-center justify-between rounded-2xl border border-black/5 bg-white/70 px-4 py-3"
                  >
                    <div className="text-sm font-medium text-[rgb(var(--ink))]">
                      {item}
                    </div>
                    <span className="text-xs text-[rgb(var(--muted))]">Drafting</span>
                  </div>
                ))}
              </div>
              <div className="mt-6 rounded-2xl border border-dashed border-black/15 bg-[rgba(34,94,116,0.06)] p-4 text-sm text-[rgb(var(--muted))]">
                Connect Stripe to keep credits topped up and workflows uninterrupted.
              </div>
            </div>
          </div>
        </main>

        <footer className="mt-auto py-10 text-sm text-[rgb(var(--muted))]">
          CVForge v0.1.0 — built for crisp storytelling and faster iteration.
        </footer>
      </div>
    </div>
  );
}
