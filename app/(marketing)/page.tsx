import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";

type CtaLinks = {
  primary: string;
  secondary: string;
  pricing: string;
};

const productTour = [
  {
    title: "Role Fit",
    body: "Scores coverage against the JD and highlights the gaps that matter for UK hiring.",
  },
  {
    title: "Evidence Engine",
    body: "Matches achievements and work history to gaps, with quality signals and targets for CV/Cover/STAR.",
  },
  {
    title: "STAR Library",
    body: "Per-gap STAR drafts you control; easy to reuse in interviews and Answer Pack.",
  },
  {
    title: "Drill Mode + Answer Pack",
    body: "Practise the weakest questions first and copy clean 90-second answers.",
  },
  {
    title: "Smart Apply + Outcome Loop",
    body: "Submission checklist, follow-ups, and outcomes in one place—no mystery statuses.",
  },
];

const faq = [
  {
    q: "Is this ChatGPT?",
    a: "No. Role Fit, Evidence Engine, and Smart Apply are deterministic. The optional Rewrite Coach uses AI, but you approve every change.",
  },
  {
    q: "Do you auto-apply or send emails?",
    a: "Never. You stay in control. CVForge prepares exports, follow-ups, and reminders; you choose when to send or submit.",
  },
  {
    q: "What if Indeed/LinkedIn blocks fetching?",
    a: "You can paste the job text. The UI guides you calmly when a site blocks automated fetch.",
  },
  {
    q: "Is this for non-technical users?",
    a: "Yes. The Apply Kit Wizard and tabs keep the workflow simple: job text → evidence → STAR → kit → submit.",
  },
  {
    q: "How do credits/subscriptions work?",
    a: "Credits power Autopack generation. Starter/Pro/Power packs are one-off; subscription is optional for monthly credits. You approve every spend.",
  },
  {
    q: "Will it overwrite my CV?",
    a: "No. You edit in-app and export when ready. You can always regenerate or tweak without losing previous versions.",
  },
];

export default async function MarketingPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const loginPath = "/login";
  const signupPath = "/login?next=/app";
  const ctas: CtaLinks = user?.id
    ? {
        primary: "/app/applications/new",
        secondary: "/app",
        pricing: "/app/billing",
      }
    : {
        primary: signupPath,
        secondary: loginPath,
        pricing: "/login?next=/app/billing",
      };

  return (
    <div className="bg-gradient-to-b from-[#f8fbff] via-white to-[#f7f4ff]">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-black text-base font-semibold text-white">
              CV
            </span>
            <div className="text-lg font-semibold tracking-tight text-[rgb(var(--ink))]">
              CVForge
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Link
              href={ctas.secondary}
              className="rounded-full border border-black/10 px-4 py-2 font-semibold text-[rgb(var(--ink))] transition hover:border-black/20"
            >
              Sign in
            </Link>
            <Link
              href={ctas.primary}
              className="rounded-full bg-[rgb(var(--accent))] px-4 py-2 font-semibold text-white shadow-sm transition hover:bg-[rgb(var(--accent-strong))]"
            >
              Get started
            </Link>
          </div>
        </header>

        <main className="mt-14 space-y-16">
          <section className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[rgb(var(--muted))]">
                Built for UK job seekers
                <span className="h-1.5 w-1.5 rounded-full bg-[rgb(var(--accent))]" />
                Deterministic workflow
              </div>
              <h1 className="text-4xl font-semibold tracking-tight text-[rgb(var(--ink))] sm:text-5xl">
                Turn any job advert into a submission-ready application in 20 minutes.
              </h1>
              <p className="max-w-2xl text-lg text-[rgb(var(--muted))]">
                Role Fit shows what&apos;s missing. Evidence Engine fills the gaps. STAR + Answer Pack prepares you for interview. Smart Apply keeps follow-ups on track.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link
                  href={ctas.primary}
                  className="rounded-2xl bg-[rgb(var(--accent))] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-[rgba(34,94,116,0.2)] transition hover:bg-[rgb(var(--accent-strong))]"
                >
                  Start now
                </Link>
                <Link
                  href="#how-it-works"
                  className="rounded-2xl border border-black/10 bg-white/80 px-6 py-3 text-sm font-semibold text-[rgb(var(--ink))] transition hover:border-black/20"
                >
                  See how it works
                </Link>
                <Link
                  href={ctas.pricing}
                  className="text-sm font-semibold text-[rgb(var(--accent-strong))] underline-offset-4 hover:underline"
                >
                  View pricing
                </Link>
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-[rgb(var(--muted))]">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1">
                  Deterministic workflow
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1">
                  You approve what&apos;s sent
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1">
                  Built for UK hiring signals
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1">
                  If Indeed/LinkedIn blocks fetching, paste the job text
                </span>
              </div>
            </div>
            <div className="relative">
              <div className="absolute -left-6 top-10 h-16 w-16 rounded-full bg-[rgba(34,94,116,0.12)] blur-2xl" />
              <div className="absolute -right-8 bottom-6 h-24 w-24 rounded-full bg-[rgba(93,63,211,0.12)] blur-2xl" />
              <div className="relative space-y-3 rounded-3xl border border-black/10 bg-white/90 p-5 shadow-xl backdrop-blur">
                {[
                  { label: "Job advert", text: "Paste or fetch the role you want" },
                  { label: "Role Fit", text: "See the gaps that matter" },
                  { label: "Evidence", text: "Attach achievements to gaps" },
                  { label: "STAR", text: "Draft a STAR story for top gaps" },
                  { label: "Answer Pack", text: "Copy 90-second answers" },
                  { label: "Apply", text: "Download kit + schedule follow-up" },
                ].map((card) => (
                  <div
                    key={card.label}
                    className="flex items-center justify-between rounded-2xl border border-black/5 bg-white/80 px-4 py-3"
                  >
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-[rgb(var(--muted))]">
                        {card.label}
                      </p>
                      <p className="text-sm font-semibold text-[rgb(var(--ink))]">
                        {card.text}
                      </p>
                    </div>
                    <span className="h-2 w-2 rounded-full bg-[rgb(var(--accent))]" />
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section id="how-it-works" className="space-y-6">
            <h2 className="text-2xl font-semibold text-[rgb(var(--ink))]">How it works</h2>
            <div className="grid gap-4 md:grid-cols-3">
              {[
                {
                  title: "1) Bring the advert",
                  body: "Paste or fetch the JD. Calm fallback when sites block fetch.",
                },
                {
                  title: "2) Aim evidence",
                  body: "Role Fit + Evidence Engine pair your achievements to the top gaps.",
                },
                {
                  title: "3) Apply + prep",
                  body: "Generate Autopack, download the kit, and practise the weakest questions.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-sm"
                >
                  <p className="text-sm font-semibold text-[rgb(var(--ink))]">{item.title}</p>
                  <p className="mt-2 text-sm text-[rgb(var(--muted))]">{item.body}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-6">
            <h2 className="text-2xl font-semibold text-[rgb(var(--ink))]">Product tour</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {productTour.map((card) => (
                <div
                  key={card.title}
                  className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-sm"
                >
                  <p className="text-sm font-semibold text-[rgb(var(--ink))]">{card.title}</p>
                  <p className="mt-2 text-sm text-[rgb(var(--muted))]">{card.body}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-4 rounded-3xl border border-black/10 bg-white/80 p-6 shadow-sm md:grid-cols-2">
            <div>
              <h3 className="text-lg font-semibold text-[rgb(var(--ink))]">
                What CVForge does
              </h3>
              <ul className="mt-3 space-y-2 text-sm text-[rgb(var(--muted))]">
                <li>Guides you through evidence-first applications.</li>
                <li>Generates ATS-Minimal and Standard exports you approve.</li>
                <li>Tracks follow-ups, outcomes, and revenue-safe credit use.</li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[rgb(var(--ink))]">
                What CVForge doesn&apos;t do
              </h3>
              <ul className="mt-3 space-y-2 text-sm text-[rgb(var(--muted))]">
                <li>No auto-apply or auto-send emails.</li>
                <li>No invented experience—evidence stays yours.</li>
                <li>No scraping beyond user-initiated fetch; calm paste path when blocked.</li>
              </ul>
            </div>
          </section>

          <section className="space-y-4 rounded-3xl border border-black/10 bg-white/80 p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
                  Optional AI Boost
                </p>
                <h3 className="text-lg font-semibold text-[rgb(var(--ink))]">
                  Rewrite Coach (opt-in)
                </h3>
              </div>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                User-approved only
              </span>
            </div>
            <p className="text-sm text-[rgb(var(--muted))]">
              Use Rewrite Coach after you write a STAR answer. It restructures; you review and approve.
              CVForge never auto-sends or auto-applies.
            </p>
          </section>

          <section className="space-y-6 rounded-3xl border border-black/10 bg-white/80 p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-2xl font-semibold text-[rgb(var(--ink))]">Pricing</h2>
              <Link
                href={ctas.pricing}
                className="rounded-full bg-[rgb(var(--accent))] px-4 py-2 text-sm font-semibold text-white hover:bg-[rgb(var(--accent-strong))]"
              >
                View pricing
              </Link>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {[
                {
                  name: "Starter",
                  price: "£9",
                  detail: "10 credits — best for one role",
                },
                {
                  name: "Pro",
                  price: "£19",
                  detail: "30 credits — best value for active applications",
                  badge: "Best value",
                },
                {
                  name: "Power",
                  price: "£39",
                  detail: "80 credits — for heavy pipelines",
                },
              ].map((pack) => (
                <div
                  key={pack.name}
                  className="rounded-2xl border border-black/10 bg-white/70 p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-[rgb(var(--ink))]">
                        {pack.name}
                      </p>
                      <p className="text-xl font-semibold text-[rgb(var(--ink))]">
                        {pack.price}
                      </p>
                    </div>
                    {pack.badge ? (
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-semibold text-amber-700">
                        {pack.badge}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm text-[rgb(var(--muted))]">{pack.detail}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-[rgb(var(--muted))]">
              Credits power Autopack generation. Subscriptions are optional; you approve every spend.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-[rgb(var(--ink))]">FAQ</h2>
            <div className="space-y-3">
              {faq.map((item) => (
                <div
                  key={item.q}
                  className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-sm"
                >
                  <p className="text-sm font-semibold text-[rgb(var(--ink))]">{item.q}</p>
                  <p className="mt-1 text-sm text-[rgb(var(--muted))]">{item.a}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-black/10 bg-white/80 p-6 text-center shadow-sm">
            <h3 className="text-xl font-semibold text-[rgb(var(--ink))]">
              Ready to cut your application time?
            </h3>
            <p className="mt-2 text-sm text-[rgb(var(--muted))]">
              Bring a job advert and evidence; CVForge handles the flow.
            </p>
            <div className="mt-4 flex justify-center gap-3">
              <Link
                href={ctas.primary}
                className="rounded-full bg-[rgb(var(--accent))] px-5 py-2 text-sm font-semibold text-white hover:bg-[rgb(var(--accent-strong))]"
              >
                Start now
              </Link>
              <Link
                href={ctas.secondary}
                className="rounded-full border border-black/10 px-5 py-2 text-sm font-semibold text-[rgb(var(--ink))] hover:border-black/20"
              >
                Sign in
              </Link>
            </div>
          </section>
        </main>

        <footer className="mt-12 py-10 text-sm text-[rgb(var(--muted))]">
          CVForge — deterministic, UK-friendly applications.
        </footer>
      </div>
    </div>
  );
}
