import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabaseUser } from "@/lib/data/supabase";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { getUserCredits, listCreditActivity } from "@/lib/data/credits";
import { getSubscriptionStatus } from "@/lib/billing/subscription-status";
import { listApplications } from "@/lib/data/applications";
import { headers } from "next/headers";
import { requireOpsAccess } from "@/lib/rbac";

export const dynamic = "force-dynamic";

async function searchUsers(query: string) {
  if (!query) return [];
  const admin = createServiceRoleClient();
  const { data, error } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 10,
  });
  if (error) return [];
  return (data?.users ?? []).filter((user) => {
    const email = user.email?.toLowerCase() ?? "";
    const q = query.toLowerCase();
    return email.includes(q) || user.id === query;
  });
}

async function buildUserSnapshot(userId: string, email: string) {
  const admin = createServiceRoleClient();
  const credits = await getUserCredits(admin, userId);
  const ledger = await listCreditActivity(admin, userId, 5);
  const subscription = await getSubscriptionStatus(admin as any, userId);
  const applications = await listApplications(admin as any, userId);
  const appCount = applications.length;
  const activeApps = applications.filter((app) => app.status !== "closed" && app.status !== "rejected").length;
  const lastActivity = applications
    .map((app) => app.last_activity_at || app.updated_at || app.created_at)
    .filter(Boolean)
    .sort()
    .reverse()[0];

  return {
    email,
    credits,
    ledger,
    subscription,
    appCount,
    activeApps,
    lastActivity,
  };
}

export default async function OpsPage({ searchParams }: { searchParams?: { q?: string } }) {
  const { supabase, user } = await getSupabaseUser();
  if (!user || !(await requireOpsAccess(user.id, user.email))) {
    notFound();
  }

  const query = searchParams?.q ?? "";
  const users = await searchUsers(query);

  const snapshots = await Promise.all(
    users.map((u) =>
      buildUserSnapshot(u.id, u.email ?? "unknown").catch(() => null)
    )
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">Ops</p>
          <h1 className="text-lg font-semibold text-[rgb(var(--ink))]">Ops Command Centre</h1>
        </div>
      </div>

      <form className="rounded-2xl border border-black/10 bg-white/80 p-4">
        <label className="text-sm font-semibold text-[rgb(var(--ink))]">
          Search users
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder="Email or user id"
            className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm"
          />
        </label>
        <button
          type="submit"
          className="mt-3 rounded-full bg-[rgb(var(--ink))] px-4 py-2 text-sm font-semibold text-white"
        >
          Search
        </button>
      </form>

      {query && users.length === 0 ? (
        <p className="text-sm text-[rgb(var(--muted))]">No users found.</p>
      ) : null}

      <div className="space-y-4">
        {users.map((u, index) => {
          const snapshot = snapshots[index];
          return (
            <div key={u.id} className="rounded-2xl border border-black/10 bg-white/80 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-[rgb(var(--ink))]">{u.email}</p>
                  <p className="text-xs text-[rgb(var(--muted))]">{u.id}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/app/ops/users/${u.id}`}
                    className="rounded-full border border-black/10 bg-[rgb(var(--ink))] px-3 py-1 text-xs font-semibold text-white"
                  >
                    Open as support
                  </Link>
                  <div className="rounded-full border border-black/10 bg-white px-3 py-1 text-[10px] font-semibold text-[rgb(var(--muted))]">
                    Copy id/email
                  </div>
                </div>
              </div>
              {snapshot ? (
                <div className="mt-3 grid gap-3 text-sm text-[rgb(var(--muted))] md:grid-cols-2">
                  <div className="space-y-1">
                    <p>Credits: {snapshot.credits}</p>
                    <p>
                      Subscription:{" "}
                      {snapshot.subscription.hasActiveSubscription
                        ? snapshot.subscription.currentPlanKey ?? "active"
                        : "none"}
                    </p>
                    <p>Apps: {snapshot.appCount} (active {snapshot.activeApps})</p>
                    <p>
                      Last activity:{" "}
                      {snapshot.lastActivity
                        ? new Date(snapshot.lastActivity).toLocaleString()
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[rgb(var(--ink))]">Recent credits</p>
                    <ul className="mt-1 space-y-1 text-xs">
                      {snapshot.ledger.map((row) => (
                        <li key={row.id} className="flex justify-between">
                          <span>{row.reason ?? "entry"}</span>
                          <span className="font-semibold text-[rgb(var(--ink))]">
                            {row.delta}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-xs text-[rgb(var(--muted))]">Unable to load snapshot.</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
