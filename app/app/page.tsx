import { redirect } from "next/navigation";
import { getUserCredits } from "@/lib/data/credits";
import { createServerClient } from "@/lib/supabase/server";
import TelemetryBanner from "./telemetry-banner";

export const dynamic = "force-dynamic";

export default async function AppPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  let credits = 0;
  let applicationCount = 0;
  let telemetryOptIn = false;

  try {
    credits = await getUserCredits(supabase, user.id);
  } catch (error) {
    console.error("[dashboard credits]", error);
  }

  try {
    const { count, error } = await supabase
      .from("applications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);

    if (error) {
      throw error;
    }

    applicationCount = count ?? 0;
  } catch (error) {
    console.error("[dashboard applications]", error);
  }

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("telemetry_opt_in")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    telemetryOptIn = Boolean(data?.telemetry_opt_in);
  } catch (error) {
    console.error("[dashboard telemetry]", error);
  }

  return (
    <div className="space-y-6">
      <TelemetryBanner telemetryOptIn={telemetryOptIn} />
      <div className="rounded-3xl border border-black/10 bg-white/80 p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.3em] text-[rgb(var(--muted))]">
          Dashboard
        </p>
        <h1 className="mt-3 text-2xl font-semibold">
          Welcome back{user?.email ? `, ${user.email}` : ""}.
        </h1>
        <p className="mt-2 text-sm text-[rgb(var(--muted))]">
          This is your Phase 0 dashboard. Replace these cards with real CV
          workflows in Phase 1.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-black/10 bg-white/70 p-5">
          <h2 className="text-sm font-semibold text-[rgb(var(--ink))]">
            Credits
          </h2>
          <p className="mt-2 text-3xl font-semibold">{credits}</p>
          <p className="mt-1 text-sm text-[rgb(var(--muted))]">
            Purchase credit packs to generate CVs and cover letters.
          </p>
        </div>
        <div className="rounded-2xl border border-black/10 bg-white/70 p-5">
          <h2 className="text-sm font-semibold text-[rgb(var(--ink))]">
            Applications
          </h2>
          <p className="mt-2 text-3xl font-semibold">{applicationCount}</p>
          <p className="mt-1 text-sm text-[rgb(var(--muted))]">
            Track everything from job targets to submission status.
          </p>
        </div>
      </div>
    </div>
  );
}
