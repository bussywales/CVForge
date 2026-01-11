import Section from "@/components/Section";
import { getUserCredits, listCreditActivity } from "@/lib/data/credits";
import { getSupabaseUser } from "@/lib/data/supabase";
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

  const getReasonLabel = (reason?: string | null) => {
    if (reason === "stripe.checkout") {
      return "Credit pack purchase";
    }
    if (reason === "autopack.generate") {
      return "Autopack generation";
    }
    return reason ?? "Unknown";
  };

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
          <div className="overflow-hidden rounded-2xl border border-black/10 bg-white/70">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-white/80 text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
                <tr className="border-b border-black/10">
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Delta</th>
                  <th className="px-4 py-3 font-medium">Reason</th>
                  <th className="px-4 py-3 font-medium">Ref</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {activity.map((entry) => {
                  const deltaValue = entry.delta ?? 0;
                  const deltaLabel =
                    deltaValue > 0 ? `+${deltaValue}` : `${deltaValue}`;
                  const deltaTone =
                    deltaValue > 0
                      ? "text-emerald-600"
                      : deltaValue < 0
                        ? "text-rose-600"
                        : "text-[rgb(var(--muted))]";
                  const refShort = entry.ref ? entry.ref.slice(0, 8) : "—";

                  return (
                    <tr key={entry.id} className="align-top">
                      <td className="px-4 py-3 text-sm text-[rgb(var(--ink))]">
                        {new Date(entry.created_at).toLocaleString(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </td>
                      <td className={`px-4 py-3 text-sm font-semibold ${deltaTone}`}>
                        {deltaLabel}
                      </td>
                      <td className="px-4 py-3 text-sm text-[rgb(var(--ink))]">
                        {getReasonLabel(entry.reason)}
                      </td>
                      <td className="px-4 py-3 text-xs text-[rgb(var(--muted))]">
                        {refShort}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}
