import Section from "@/components/Section";
import { getUserCredits, listCreditActivity } from "@/lib/data/credits";
import { getSupabaseUser } from "@/lib/data/supabase";
import CreditActivityTable from "./credit-activity-table";
import CheckoutButton from "./checkout-button";

export const dynamic = "force-dynamic";

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
  const activity = await listCreditActivity(supabase, user.id, 20);

  const formatUKDateTime = (value: string) => {
    const date = new Date(value);
    const datePart = date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    const timePart = date.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    return `${datePart}, ${timePart}`;
  };

  const getReasonLabel = (reason?: string | null) => {
    if (reason === "stripe.checkout") {
      return "Credit pack purchase";
    }
    if (reason === "autopack.generate") {
      return "Autopack generation";
    }
    return reason ?? "Unknown";
  };

  const activityRows = activity.map((entry) => {
    const deltaValue = entry.delta ?? 0;
    const deltaLabel = deltaValue > 0 ? `+${deltaValue}` : `${deltaValue}`;
    const deltaTone: "positive" | "negative" | "neutral" =
      deltaValue > 0 ? "positive" : deltaValue < 0 ? "negative" : "neutral";

    return {
      id: entry.id,
      createdLabel: formatUKDateTime(entry.created_at),
      deltaLabel,
      deltaTone,
      reasonLabel: getReasonLabel(entry.reason),
      ref: entry.ref,
      refShort: entry.ref ? entry.ref.slice(0, 8) : "—",
    };
  });

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

      <Section
        title="Recent activity"
        description="Your latest credit changes."
      >
        {activity.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-black/20 bg-white/60 p-6 text-sm text-[rgb(var(--muted))]">
            No credit activity yet.
          </div>
        ) : (
          <CreditActivityTable rows={activityRows} />
        )}
      </Section>
    </div>
  );
}
