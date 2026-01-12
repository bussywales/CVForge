import Link from "next/link";
import Section from "@/components/Section";
import { listApplications } from "@/lib/data/applications";
import {
  applicationStatusLabels,
  normaliseApplicationStatus,
} from "@/lib/application-status";
import { getSupabaseUser } from "@/lib/data/supabase";
import { deleteApplicationAction } from "./actions";
import DeleteApplicationForm from "./delete-application-form";

const statusStyles: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  ready: "bg-indigo-100 text-indigo-700",
  applied: "bg-blue-100 text-blue-700",
  interviewing: "bg-amber-100 text-amber-700",
  offer: "bg-emerald-100 text-emerald-700",
  rejected: "bg-rose-100 text-rose-700",
  on_hold: "bg-slate-200 text-slate-700",
};

export default async function ApplicationsPage() {
  const { supabase, user } = await getSupabaseUser();

  if (!user) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        Your session expired. Please sign in again.
      </div>
    );
  }

  const applications = await listApplications(supabase, user.id);

  return (
    <Section
      title="Applications"
      description="Track job intake, status, and notes in one place."
      action={
        <Link
          href="/app/applications/new"
          className="rounded-2xl bg-[rgb(var(--accent))] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[rgb(var(--accent-strong))]"
        >
          New application
        </Link>
      }
    >
      {applications.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/20 bg-white/60 p-6 text-sm text-[rgb(var(--muted))]">
          No applications yet. Create your first job intake to start tracking
          progress.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-y-3">
            <thead className="text-left text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
              <tr>
                <th className="px-3">Job title</th>
                <th className="px-3">Company</th>
                <th className="px-3">Status</th>
                <th className="px-3">Created</th>
                <th className="px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((application) => (
                <tr key={application.id} className="bg-white/80">
                  <td className="rounded-l-2xl px-3 py-3 text-sm font-semibold text-[rgb(var(--ink))]">
                    {application.job_title}
                  </td>
                  <td className="px-3 py-3 text-sm text-[rgb(var(--muted))]">
                    {application.company_name ?? application.company ?? "—"}
                  </td>
                  <td className="px-3 py-3 text-sm">
                    {(() => {
                      const status = normaliseApplicationStatus(
                        application.status
                      );
                      return (
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        statusStyles[status] ?? "bg-slate-100"
                      }`}
                    >
                      {applicationStatusLabels[status]}
                    </span>
                      );
                    })()}
                  </td>
                  <td className="px-3 py-3 text-sm text-[rgb(var(--muted))]">
                    {new Date(application.created_at).toLocaleDateString(
                      undefined,
                      {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      }
                    )}
                  </td>
                  <td className="rounded-r-2xl px-3 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Link
                        href={`/app/applications/${application.id}`}
                        className="rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-xs font-semibold text-[rgb(var(--ink))]"
                      >
                        View / Edit
                      </Link>
                      <DeleteApplicationForm
                        id={application.id}
                        deleteAction={deleteApplicationAction}
                        label="Delete"
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}
