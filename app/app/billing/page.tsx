import Section from "@/components/Section";
import { getUserCredits } from "@/lib/data/credits";
import { getSupabaseUser } from "@/lib/data/supabase";
import CheckoutButton from "./checkout-button";

type BillingPageProps = {
  searchParams?: { success?: string; canceled?: string };
};

export default async function BillingPage({ searchParams }: BillingPageProps) {
  const { supabase, user } = await getSupabaseUser();

  if (!user) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        Your session expired. Please sign in again.
      </div>
    );
  }

  const credits = await getUserCredits(supabase, user.id);

  return (
    <div className="space-y-6">
      {searchParams?.success ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          Payment received. Your credits will appear shortly.
        </div>
      ) : null}
      {searchParams?.canceled ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
          Checkout was canceled. You can try again anytime.
        </div>
      ) : null}

      <Section
        title="Billing & Credits"
        description="Credits are used to generate new autopacks."
        action={<CheckoutButton />}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-black/10 bg-white/70 p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
              Current balance
            </p>
            <p className="mt-3 text-3xl font-semibold text-[rgb(var(--ink))]">
              {credits}
            </p>
            <p className="mt-2 text-sm text-[rgb(var(--muted))]">
              Credits are deducted when an autopack is generated.
            </p>
          </div>
          <div className="rounded-2xl border border-black/10 bg-white/70 p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
              Credit pack
            </p>
            <p className="mt-3 text-xl font-semibold text-[rgb(var(--ink))]">
              £9 = 10 credits
            </p>
            <p className="mt-2 text-sm text-[rgb(var(--muted))]">
              Use credits for CV + cover letter + STAR answer generation.
            </p>
          </div>
        </div>
      </Section>
    </div>
  );
}
