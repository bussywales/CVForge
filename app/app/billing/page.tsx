import Section from "@/components/Section";
import { getUserCredits, listCreditActivity } from "@/lib/data/credits";
import { getSupabaseUser } from "@/lib/data/supabase";
import CreditActivityTable from "./credit-activity-table";
import PackSelector from "./pack-selector";
import { fetchBillingSettings, upsertBillingSettings } from "@/lib/data/billing";
import { SUBSCRIPTION_PLANS } from "@/lib/billing/plans";
import { createServerClient } from "@/lib/supabase/server";
import { ensureReferralCode } from "@/lib/referrals";
import CopyIconButton from "@/components/CopyIconButton";

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
  const settings = await fetchBillingSettings(supabase, user.id);
  const referral = await ensureReferralCode(supabase, user.id);
  const appCount =
    (
      await supabase
        .from("applications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
    ).count ?? 0;
  const autopackCount =
    (
      await supabase
        .from("autopacks")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
    ).count ?? 0;
  const interviewCount =
    (
      await supabase
        .from("application_outcomes")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .in("outcome_status", ["interview_scheduled", "interview_completed", "offer"])
    ).count ?? 0;

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
        action={
          <PackSelector
            contextLabel="Top up applications"
            returnTo="/app/billing"
            compact
          />
        }
      >
        <div className="grid gap-4 md:grid-cols-3">
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
              What 1 credit does
            </p>
            <p className="mt-2 text-sm text-[rgb(var(--muted))]">
              1 credit generates a tailored CV + cover letter + STAR answers for one
              application.
            </p>
          </div>
          <div className="rounded-2xl border border-black/10 bg-white/70 p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
              Your ROI so far
            </p>
            <div className="mt-2 space-y-1 text-sm text-[rgb(var(--ink))]">
              <p>Applications created: {appCount}</p>
              <p>Autopacks generated: {autopackCount}</p>
              <p>Interviews/offers: {interviewCount}</p>
            </div>
          </div>
        </div>
      </Section>

      <Section
        title="Subscription"
        description="Optional monthly plan with auto-granted credits."
      >
        <div className="flex flex-col gap-3 rounded-2xl border border-black/10 bg-white/80 p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
              Status
            </p>
            <p className="text-sm font-semibold text-[rgb(var(--ink))]">
              {settings?.subscription_status ?? "None"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {SUBSCRIPTION_PLANS.slice(0, 1).map((plan) => (
              <form key={plan.key} action="/api/stripe/checkout" method="POST">
                <input type="hidden" name="mode" value="subscription" />
                <input type="hidden" name="planKey" value={plan.key} />
                <input type="hidden" name="returnTo" value="/app/billing" />
                <button
                  type="submit"
                  className="rounded-full border border-black/10 bg-[rgb(var(--ink))] px-4 py-2 text-sm font-semibold text-white hover:bg-black"
                >
                  Subscribe ({plan.creditsPerMonth} credits / mo)
                </button>
              </form>
            ))}
            <form action="/api/stripe/portal" method="POST">
              <input type="hidden" name="returnTo" value="/app/billing" />
              <button
                type="submit"
                className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-[rgb(var(--ink))] hover:bg-slate-50"
                disabled={!settings?.stripe_customer_id}
              >
                Manage in Stripe
              </button>
            </form>
          </div>
        </div>
      </Section>

      <Section
        title="Auto top-up (optional)"
        description="Turn on auto top-up when credits drop below a threshold."
      >
        <form
          className="space-y-3 rounded-2xl border border-black/10 bg-white/80 p-4"
          action={async (formData) => {
            "use server";
            const client = createServerClient();
            const {
              data: { user: current },
            } = await client.auth.getUser();
            if (!current) return;
            const enabled = formData.get("enabled") === "on";
            const packKey = (formData.get("pack") as string) ?? null;
            const threshold = Number(formData.get("threshold") ?? 3);
            await upsertBillingSettings(client, current.id, {
              auto_topup_enabled: enabled,
              auto_topup_pack_key: packKey,
              auto_topup_threshold: Number.isFinite(threshold) ? threshold : 3,
            });
          }}
        >
          <div className="flex flex-wrap gap-3">
            <label className="flex items-center gap-2 text-sm font-semibold text-[rgb(var(--ink))]">
              <input
                type="checkbox"
                name="enabled"
                defaultChecked={settings?.auto_topup_enabled ?? false}
                className="h-4 w-4 rounded border-black/20"
              />
              Enable auto top-up
            </label>
            <select
              name="pack"
              defaultValue={settings?.auto_topup_pack_key ?? "starter"}
              className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm"
            >
              <option value="starter">Starter (10 credits)</option>
              <option value="pro">Pro (30 credits)</option>
              <option value="power">Power (80 credits)</option>
            </select>
            <select
              name="threshold"
              defaultValue={settings?.auto_topup_threshold ?? 3}
              className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm"
            >
              {[3, 5, 10].map((t) => (
                <option key={t} value={t}>
                  Trigger at {t} credits
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs text-[rgb(var(--muted))]">
            No background charges; you’ll be redirected to checkout when auto
            top-up is triggered.
          </p>
          <button
            type="submit"
            className="rounded-full border border-black/10 bg-[rgb(var(--ink))] px-4 py-2 text-sm font-semibold text-white hover:bg-black"
          >
            Save settings
          </button>
        </form>
      </Section>

      <Section
        title="Refer a friend"
        description="Invite a friend; you both get +3 credits when they join."
      >
        <div className="space-y-2 rounded-2xl border border-black/10 bg-white/80 p-4">
          {referral?.code ? (
            <>
              <p className="text-sm font-semibold text-[rgb(var(--ink))]">
                Your invite link
              </p>
              <p className="break-all rounded-lg border border-black/10 bg-white px-3 py-2 text-sm">
                {`${(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(
                  /\/$/,
                  ""
                )}/auth/signup?ref=${referral.code}`}
              </p>
              <CopyIconButton
                text={`${(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(
                  /\/$/,
                  ""
                )}/auth/signup?ref=${referral.code}`}
                className="mt-2"
                iconOnly
              />
              <p className="text-xs text-[rgb(var(--muted))]">
                Copy and share. Credits apply once per new user.
              </p>
            </>
          ) : (
            <p className="text-sm text-[rgb(var(--muted))]">
              Unable to load referral code right now.
            </p>
          )}
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
