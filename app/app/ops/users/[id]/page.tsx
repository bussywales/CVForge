import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabaseUser } from "@/lib/data/supabase";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { getUserCredits, listCreditActivity } from "@/lib/data/credits";
import { getSubscriptionStatus } from "@/lib/billing/subscription-status";
import { listApplications } from "@/lib/data/applications";
import { buildNextBestActions } from "@/lib/next-best-actions";
import { getUserRole, requireOpsAccess, isAdminRole, canAssignRole, type UserRole } from "@/lib/rbac";
import RoleEditor from "./role-editor";

export const dynamic = "force-dynamic";

export default async function OpsUserPage({ params }: { params: { id: string } }) {
  const { user } = await getSupabaseUser();
  if (!user || !(await requireOpsAccess(user.id, user.email))) {
    notFound();
  }

  const admin = createServiceRoleClient();
  const authUser = await admin.auth.admin.getUserById(params.id).catch(() => null);
  if (!authUser?.data?.user) {
    notFound();
  }
  const viewerRole = (await getUserRole(user.id)).role;
  const targetRoleInfo = await getUserRole(params.id);
  const canEdit = isAdminRole(viewerRole) && canAssignRole(viewerRole, targetRoleInfo.role);

  const credits = await getUserCredits(admin as any, params.id);
  const ledger = await listCreditActivity(admin as any, params.id, 5);
  const subscription = await getSubscriptionStatus(admin as any, params.id);
  const applications = (await listApplications(admin as any, params.id)).slice(0, 10);
  const lastOutcomes = await admin
    .from("outcomes")
    .select("id,status,reason,happened_at")
    .eq("user_id", params.id)
    .order("happened_at", { ascending: false })
    .limit(5);
  const outreachActions = await admin
    .from("application_activities")
    .select("id,type,occurred_at,subject,application_id")
    .eq("user_id", params.id)
    .ilike("type", "outreach%")
    .order("occurred_at", { ascending: false })
    .limit(5);

  const dueFollowups = applications.filter((app) => {
    const due = app.next_action_due ?? app.outreach_next_due_at;
    return due && new Date(due).getTime() <= Date.now();
  }).length;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">Ops</p>
        <h1 className="text-lg font-semibold text-[rgb(var(--ink))]">User support dossier</h1>
        <p className="text-sm text-[rgb(var(--muted))]">{authUser.data.user.email}</p>
        <p className="text-xs text-[rgb(var(--muted))]">{authUser.data.user.id}</p>
      </div>

      <div className="rounded-2xl border border-black/10 bg-white/80 p-4">
        <p className="text-sm font-semibold text-[rgb(var(--ink))]">Billing</p>
        <div className="mt-2 grid gap-3 text-sm text-[rgb(var(--muted))] md:grid-cols-2">
          <div>
            <p>Credits: {credits}</p>
            <p>
              Subscription:{" "}
              {subscription.hasActiveSubscription
                ? subscription.currentPlanKey ?? "active"
                : "none"}
            </p>
            <p>Role: {targetRoleInfo.role}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-[rgb(var(--ink))]">Recent credits</p>
            <ul className="mt-1 space-y-1 text-xs">
              {ledger.map((row) => (
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
      </div>

      <div className="rounded-2xl border border-black/10 bg-white/80 p-4">
        <p className="text-sm font-semibold text-[rgb(var(--ink))]">Applications</p>
        <div className="mt-2 space-y-3">
          {applications.map((app) => {
            const actions = buildNextBestActions({
              applicationId: app.id,
              closingDate: app.closing_date,
              pendingApplyItems: 0,
              jobTextStatus: app.job_fetch_status,
              hasJobText: Boolean(app.job_description),
              roleFitGaps: 0,
              starDraftCount: 0,
              hasDueFollowup: Boolean(app.next_action_due),
              isSubmitted: Boolean(app.submitted_at),
              outcomeRecorded: Boolean(app.last_outcome_status),
            });
            return (
              <div key={app.id} className="rounded-xl border border-black/10 bg-white/70 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-[rgb(var(--ink))]">
                      {app.job_title}
                    </p>
                    <p className="text-xs text-[rgb(var(--muted))]">
                      {app.company_name ?? app.company ?? "—"}
                    </p>
                  </div>
                  {actions[0] ? (
                    <Link
                      href={actions[0].href}
                      className="rounded-full border border-black/10 bg-[rgb(var(--ink))] px-3 py-1 text-xs font-semibold text-white"
                    >
                      {actions[0].label}
                    </Link>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-[rgb(var(--muted))]">Status: {app.status}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-black/10 bg-white/80 p-4">
        <p className="text-sm font-semibold text-[rgb(var(--ink))]">Outreach</p>
        <p className="text-sm text-[rgb(var(--muted))]">Due/overdue follow-ups: {dueFollowups}</p>
        <ul className="mt-2 space-y-1 text-xs text-[rgb(var(--muted))]">
          {(outreachActions.data ?? []).map((row) => (
            <li key={row.id}>
              {row.type} · {row.subject ?? "—"} · {row.occurred_at}
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border border-black/10 bg-white/80 p-4">
        <p className="text-sm font-semibold text-[rgb(var(--ink))]">Outcomes</p>
        <ul className="mt-2 space-y-1 text-xs text-[rgb(var(--muted))]">
          {(lastOutcomes.data ?? []).map((row) => (
            <li key={row.id}>
              {row.status} {row.reason ? `· ${row.reason}` : ""} · {row.happened_at}
            </li>
          ))}
        </ul>
      </div>
      {canEdit ? (
        <RoleEditor
          targetUserId={params.id}
          targetEmail={authUser.data.user.email ?? "unknown"}
          currentRole={targetRoleInfo.role as UserRole}
          canSetSuperAdmin={viewerRole === "super_admin"}
        />
      ) : null}
    </div>
  );
}
