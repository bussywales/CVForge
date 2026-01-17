import Section from "@/components/Section";
import { getUserCredits, listCreditActivity } from "@/lib/data/credits";
import { getSupabaseUser } from "@/lib/data/supabase";
import CreditActivityTable from "./credit-activity-table";
import PackSelector from "./pack-selector";
import { fetchBillingSettings, upsertBillingSettings } from "@/lib/data/billing";
import { recommendPack } from "@/lib/billing/recommendation";
import { CREDIT_PACKS, formatGbp } from "@/lib/billing/packs-data";
import {
  deriveSubscriptionSignalsFromLedger,
  recommendSubscriptionPlanV2,
} from "@/lib/billing/subscription-reco";
import { buildSubscriptionRetention } from "@/lib/subscription-retention";
import { createServerClient } from "@/lib/supabase/server";
import { ensureReferralCode } from "@/lib/referrals";
import CopyIconButton from "@/components/CopyIconButton";
import BillingEventLogger from "./billing-event-logger";
import ProofChips from "./proof-chips";
import RecommendedCta from "./recommended-cta";
import PostPurchaseSuccessBanner from "@/components/PostPurchaseSuccessBanner";
import { getBillingOfferComparison } from "@/lib/billing/compare";
import BillingDiagnostics from "./billing-diagnostics";
import { getPackAvailability, getPlanAvailability } from "@/lib/billing/availability";
import SubscriptionPlansSection from "./subscription-plans-section";
import { getSubscriptionStatus } from "@/lib/billing/subscription-status";
import { getInsightsSummary } from "@/lib/insights";
import { buildWeeklyReviewSummary, getIsoWeekKey } from "@/lib/weekly-review";
import PortalReturnBanner from "./portal-return-banner";
import StreakSaverBanner from "./streak-saver-banner";
import SubscriptionHome from "./subscription-home";
import { parsePortalReturn, portalReturnKey } from "@/lib/billing/portal-return";
import SubSaveOfferCard from "./sub-save-offer-card";
import { recommendSaveOffer } from "@/lib/billing/sub-save-offer";
import SubCancelReasons from "./sub-cancel-reasons";

export const dynamic = "force-dynamic";

type BillingPageProps = {
  searchParams?: {
    success?: string;
    canceled?: string;
    diag?: string;
    portal?: string;
    from?: string;
    plan?: string;
    status?: string;
    purchased?: string;
    sub?: string;
    mode?: string;
  };
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
  const activitySignals = await listCreditActivity(supabase, user.id, 200);
  const insightsSummary = await getInsightsSummary(supabase, user.id);
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
  const dueFollowups =
    (
      await supabase
        .from("applications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .lte("next_action_due", new Date().toISOString())
    ).count ?? 0;
  const practiceBacklog =
    (
      await supabase
        .from("interview_practice_answers")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
    ).count ?? 0;
  const latestAppRes = await supabase
    .from("applications")
    .select("id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1);
  const latestApplicationId = latestAppRes.data?.[0]?.id ?? null;
  const recommendation = recommendPack({
    credits,
    activeApplications: appCount,
    dueFollowups,
    practiceBacklog,
    stage: interviewCount > 0 ? "interview" : appCount > 0 ? "draft" : "draft",
  });
  const recommendedPack =
    CREDIT_PACKS.find((pack) => pack.key === recommendation.recommendedPack) ??
    CREDIT_PACKS[0];
  const signals = deriveSubscriptionSignalsFromLedger(activitySignals);
  const subscriptionPlanReco = recommendSubscriptionPlanV2({
    activeApplications: appCount,
    completions7: signals.completions7,
    creditsSpent30: signals.creditsSpent30,
    topups30: signals.topups30,
  });
  const subscriptionStatus = await getSubscriptionStatus(supabase, user.id);
  const hasSubscription = subscriptionStatus.hasActiveSubscription;
  const packAvailability = getPackAvailability();
  const portalState = parsePortalReturn(searchParams ?? undefined);
  const planAvailability = subscriptionStatus.availablePlans;
  const comparison = getBillingOfferComparison({
    credits,
    activeApplications: appCount,
    hasSubscription,
    recommendedPlanKey: subscriptionPlanReco.recommendedPlanKey,
    recommendedPackKey: recommendedPack.key,
    subscriptionAvailable: Boolean(planAvailability.monthly_30 || planAvailability.monthly_80),
  });
  const anyPackMissing = CREDIT_PACKS.some((pack) => !packAvailability[pack.key]);
  const anySubMissing = !planAvailability.monthly_30 || !planAvailability.monthly_80;
  const diagParam = searchParams?.diag === "1";
  const isProd = process.env.NEXT_PUBLIC_VERCEL_ENV === "production";
  const showDiagnostics = (anyPackMissing || anySubMissing) && (diagParam || !isProd);
  const showPortalReturn = portalState.portal;
  const fromStreakSaver = searchParams?.from === "streak_saver";
  const streakPlanParam =
    searchParams?.plan === "monthly_80" || searchParams?.plan === "monthly_30"
      ? (searchParams.plan as "monthly_30" | "monthly_80")
      : null;
  const streakStatus =
    (searchParams?.status === "success" || searchParams?.status === "cancel"
      ? (searchParams.status as "success" | "cancel")
      : null) ??
    (searchParams?.purchased ? "success" : null) ??
    (searchParams?.canceled ? "cancel" : null);
  const weekKey = getIsoWeekKey(new Date());
  const weekRange = (() => {
    const now = new Date();
    const start = new Date(now);
    const day = start.getDay();
    const diff = (day === 0 ? -6 : 1) - day;
    start.setDate(start.getDate() + diff);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    return { start, end };
  })();
  const appsRes = await supabase
    .from("applications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  const weeklyReviewSummary = buildWeeklyReviewSummary(
    {
      activities: insightsSummary.activities ?? [],
      outcomes: insightsSummary.outcomes ?? [],
      apps: appsRes.data ?? [],
    },
    weekRange
  );
  const topActions = insightsSummary.topActions.slice(0, 3).map((action) => ({
    label: action.label,
    href: action.href,
    why: action.why,
    applicationId: action.applicationId,
  }));
  const retentionSummary = hasSubscription
    ? buildSubscriptionRetention({
        planKey: subscriptionStatus.currentPlanKey ?? "monthly_30",
        ledger: activitySignals,
        weeklyReview: weeklyReviewSummary,
        topActions: insightsSummary.topActions.slice(0, 3),
        weekKey,
      })
    : null;
  const portalKey = portalReturnKey(portalState, weekKey);

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
      <PostPurchaseSuccessBanner
        show={Boolean(searchParams?.success)}
        applicationId={latestApplicationId ?? undefined}
        subscriptionStatus={settings?.subscription_status ?? null}
      />
      {fromStreakSaver ? (
        <StreakSaverBanner planKey={streakPlanParam} status={streakStatus} isActive={hasSubscription} />
      ) : null}
      {hasSubscription && retentionSummary ? (
        <SubscriptionHome
          planKey={(subscriptionStatus.currentPlanKey ?? "monthly_30") as "monthly_30" | "monthly_80"}
          summary={retentionSummary}
          actions={topActions}
          latestApplicationId={latestApplicationId}
          returnTo="/app/billing"
        />
      ) : null}
      {showPortalReturn ? (
        <PortalReturnBanner
          applicationId={latestApplicationId}
          state={portalState}
          isActive={hasSubscription}
          portalKey={portalKey}
        />
      ) : null}
      {showPortalReturn && portalState.flow === "cancel" && (hasSubscription || subscriptionStatus.currentPlanKey) && retentionSummary ? (
        <div className="space-y-3">
          <SubSaveOfferCard
            weekKey={weekKey}
            reco={recommendSaveOffer({
              planKey: (subscriptionStatus.currentPlanKey ?? "monthly_30") as "monthly_30" | "monthly_80",
              creditsUsed: retentionSummary.creditsUsed,
              completions: retentionSummary.completions,
              movedForward: retentionSummary.movedForward,
              risk: retentionSummary.risk,
            })}
            planKey={(subscriptionStatus.currentPlanKey ?? "monthly_30") as "monthly_30" | "monthly_80"}
            applicationId={latestApplicationId}
            returnTo="/app/billing"
            show
            portalKey={portalKey}
          />
          <div className="mt-3">
            <SubCancelReasons
              weekKey={weekKey}
              portalKey={portalKey}
              state={{ flow: portalState.flow, plan: portalState.plan }}
              applicationId={latestApplicationId}
              returnTo="/app/billing"
            />
          </div>
        </div>
      ) : null}

      <BillingEventLogger
        applicationId={latestApplicationId}
        recommendedPackKey={recommendation.recommendedPack}
      />

      <Section
        id="packs"
        title="Top up to finish your next applications"
        description={`Based on your current workload: ${appCount} active application${appCount === 1 ? "" : "s"}.`}
      >
        <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
                  Recommended
                </p>
                <p className="text-2xl font-semibold text-[rgb(var(--ink))]">
                  {recommendedPack.name} • {formatGbp(recommendedPack.priceGbp)}
                </p>
                <p className="text-sm text-[rgb(var(--muted))]">
                  {recommendedPack.credits} credits · enough for{" "}
                  {appCount > 0
                    ? `${Math.min(appCount, recommendedPack.credits)} application${
                        Math.min(appCount, recommendedPack.credits) === 1 ? "" : "s"
                      }`
                    : "your next 1–3 applications"}
                </p>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs text-[rgb(var(--ink))] shadow-sm">
                Now: {credits} → After: {credits + recommendedPack.credits}
              </div>
            </div>
            <RecommendedCta
              packKey={recommendedPack.key}
              priceLabel={formatGbp(recommendedPack.priceGbp)}
              packName={recommendedPack.name}
              applicationId={latestApplicationId}
              returnTo="/app/billing"
              packAvailable={packAvailability[recommendedPack.key]}
            />
            <p className="text-xs text-[rgb(var(--muted))]">
              You’ll return and resume where you left off.
            </p>
            <ProofChips reasons={recommendation.reasons} />
            <div className="rounded-2xl border border-emerald-100 bg-white px-3 py-2 text-xs text-[rgb(var(--muted))]">
              Includes: Autopacks · Interview Pack · Answer Pack
            </div>
          </div>
          <div className="space-y-3 rounded-2xl border border-black/10 bg-white/70 p-5">
            <div>
              <p className="text-sm font-semibold text-[rgb(var(--ink))]">
                What you can do next
              </p>
              <ul className="mt-2 space-y-1 text-sm text-[rgb(var(--muted))]">
                <li>Generate Autopack(s)</li>
                <li>Export Interview + Answer Pack</li>
                <li>Download Application Kit, submit, schedule follow-up</li>
              </ul>
            </div>
            <div className="space-y-1 rounded-2xl border border-black/10 bg-slate-50 p-3 text-[11px] text-[rgb(var(--muted))]">
              <p className="text-sm font-semibold text-[rgb(var(--ink))]">
                Trust & safeguards
              </p>
              <p>You approve every output.</p>
              <p>Blocked job sites? Paste job text safely.</p>
              <p>ATS-minimal export available anytime.</p>
            </div>
          </div>
        </div>
      </Section>

      <div id="subscription-plans">
        <SubscriptionPlansSection
          applicationId={latestApplicationId}
          recommendedPlanKey={subscriptionPlanReco.recommendedPlanKey}
          initialPlanKey={streakPlanParam ?? subscriptionPlanReco.recommendedPlanKey}
          reasonChips={subscriptionPlanReco.reasonChips}
          planAvailability={planAvailability}
          hasSubscription={hasSubscription}
          currentPlanKey={subscriptionStatus.currentPlanKey}
          canManageInPortal={subscriptionStatus.canManageInPortal}
          returnTo="/app/billing"
          comparison={comparison}
          recommendedPack={recommendedPack}
          packAvailable={packAvailability[recommendedPack.key]}
          fromStreakSaver={fromStreakSaver}
        />
      </div>

      {showDiagnostics ? <BillingDiagnostics show={true} /> : null}

      <Section title="Need more or less?" description="Secondary options if you prefer another size.">
        <PackSelector
          contextLabel="Other packs"
          returnTo="/app/billing"
          compact
          applicationId={latestApplicationId ?? undefined}
          packs={CREDIT_PACKS.filter((pack) => pack.key !== recommendation.recommendedPack)}
          compactCards
          packAvailability={packAvailability}
        />
        <div className="mt-3 grid gap-2 text-xs text-[rgb(var(--muted))] md:grid-cols-3">
          <p>Starter: Best for 1–2 applications this week.</p>
          <p>Pro: Best for active searches.</p>
          <p>Power: Best for batch applying.</p>
        </div>
      </Section>

      <Section
        title="Balance & usage"
        description="Credits power Autopacks, Interview Pack, Answer Pack, and Application Kits."
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
              1 credit generates a tailored CV + cover letter + STAR answers for one application.
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
          <div className="flex flex-wrap items-center gap-3">
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
            <button
              type="submit"
              className="rounded-full border border-black/10 bg-[rgb(var(--ink))] px-4 py-2 text-sm font-semibold text-white hover:bg-black"
            >
              Save
            </button>
          </div>
          <p className="text-xs text-[rgb(var(--muted))]">
            You’ll be redirected to Stripe to confirm any payment.
          </p>
        </form>
      </Section>

      <Section
        id="refer"
        title="Refer a friend"
        description="Invite a friend; you both get +3 credits when they join."
      >
        <div className="space-y-2 rounded-2xl border border-black/10 bg-white/80 p-4">
          {referral?.code ? (
            <>
              <p className="text-sm font-semibold text-[rgb(var(--ink))]">
                Your invite link
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <p className="flex-1 break-all rounded-lg border border-black/10 bg-white px-3 py-2 text-sm">
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
                  className="shrink-0"
                  iconOnly
                />
              </div>
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
