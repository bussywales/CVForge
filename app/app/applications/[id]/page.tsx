import Link from "next/link";
import Section from "@/components/Section";
import { fetchApplication } from "@/lib/data/applications";
import { listAutopacks } from "@/lib/data/autopacks";
import { getSupabaseUser } from "@/lib/data/supabase";
import { deleteApplicationAction, updateApplicationAction } from "../actions";
import ApplicationForm from "../application-form";
import AutopacksSection from "../autopacks-section";
import DeleteApplicationForm from "../delete-application-form";

type ApplicationPageProps = {
  params: { id: string };
  searchParams?: { created?: string };
};

export default async function ApplicationPage({
  params,
  searchParams,
}: ApplicationPageProps) {
  const { supabase, user } = await getSupabaseUser();

  if (!user) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        Your session expired. Please sign in again.
      </div>
    );
  }

  const application = await fetchApplication(supabase, user.id, params.id);

  if (!application) {
    return (
      <div className="space-y-4">
        <Link
          href="/app/applications"
          className="text-sm text-[rgb(var(--muted))]"
        >
          ← Back to applications
        </Link>
        <div className="rounded-3xl border border-black/10 bg-white/80 p-6 text-sm text-[rgb(var(--muted))]">
          This application was not found or you do not have access.
        </div>
      </div>
    );
  }

  const autopacks = await listAutopacks(supabase, user.id, application.id);
  const jobUrl = application.job_url?.trim() ?? "";
  let safeJobUrl: string | null = null;
  let jobHost = "";

  if (jobUrl) {
    try {
      const parsed = new URL(jobUrl);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        safeJobUrl = parsed.toString();
        jobHost = parsed.host;
      }
    } catch {
      safeJobUrl = null;
    }
  }

  return (
    <div className="space-y-6">
      <Link href="/app/applications" className="text-sm text-[rgb(var(--muted))]">
        ← Back to applications
      </Link>

      {searchParams?.created ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          Application created. You can keep refining the details here.
        </div>
      ) : null}

      <Section
        title="Edit application"
        description="Update the role details and keep status current."
      >
        <ApplicationForm
          mode="edit"
          initialValues={application}
          action={updateApplicationAction}
        />
      </Section>

      <Section
        title="Job advert"
        description="Keep the original listing link handy."
      >
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-sm text-[rgb(var(--muted))]">
          {safeJobUrl ? (
            <>
              <span className="text-[rgb(var(--ink))]">
                {jobHost || "Open advert"}
              </span>
              <a
                href={safeJobUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-black/10 bg-white/80 px-3 py-1 text-xs font-semibold text-[rgb(var(--ink))] transition hover:border-black/20"
              >
                Open advert
              </a>
            </>
          ) : (
            <>
              <span>Not added</span>
              <Link
                href={`/app/applications/${application.id}#job_url`}
                className="rounded-full border border-black/10 bg-white/80 px-3 py-1 text-xs font-semibold text-[rgb(var(--ink))] transition hover:border-black/20"
              >
                Add link
              </Link>
            </>
          )}
        </div>
      </Section>

      <AutopacksSection applicationId={application.id} autopacks={autopacks} />

      <Section
        title="Danger zone"
        description="Delete the application if you no longer need it."
      >
        <DeleteApplicationForm
          id={application.id}
          deleteAction={deleteApplicationAction}
          label="Delete application"
        />
      </Section>
    </div>
  );
}
