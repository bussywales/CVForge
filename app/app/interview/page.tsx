import Link from "next/link";
import Section from "@/components/Section";
import { getSupabaseUser } from "@/lib/data/supabase";
import SupportFocusClient from "@/app/app/applications/support-focus-client";

export const dynamic = "force-dynamic";

export default async function InterviewPage() {
  const { supabase, user } = await getSupabaseUser();

  if (!user) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        Your session expired. Please sign in again.
      </div>
    );
  }

  const [interviewStatus, practiceStatus] = await Promise.all([
    supabase
      .from("applications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .ilike("status", "%interview%"),
    supabase
      .from("interview_practice_answers")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
  ]);
  const hasInterviews = (interviewStatus.count ?? 0) + (practiceStatus.count ?? 0) > 0;

  return (
    <div className="space-y-4">
      <SupportFocusClient applicationId={null} />
      {!hasInterviews ? (
        <div className="rounded-2xl border border-dashed border-black/10 bg-white/80 p-4 text-sm text-[rgb(var(--muted))]">
          <p>No interviews yet. Schedule one to unlock prep flows.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link
              href="/app/applications/new"
              className="rounded-full border border-black/10 bg-[rgb(var(--ink))] px-3 py-1 text-[11px] font-semibold text-white"
            >
              Create application
            </Link>
            <Link
              href="/app/pipeline"
              className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-[rgb(var(--ink))]"
            >
              View pipeline
            </Link>
          </div>
        </div>
      ) : null}
      <Section
        title="Interview Focus Session"
        description="Jump back into interview prep. Support links scroll here and highlight the section."
      >
        <div
          id="interview-focus-session"
          className="rounded-2xl border border-black/10 bg-white/80 p-4 text-sm text-[rgb(var(--ink))]"
        >
          <p className="text-[rgb(var(--muted))]">
            Pick an application to run the Interview Focus Session flow. Support deep links will highlight this section automatically.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href="/app/applications"
              className="rounded-full border border-black/10 bg-[rgb(var(--ink))] px-4 py-2 text-xs font-semibold text-white"
            >
              Open applications
            </Link>
            <Link
              href="/app/pipeline"
              className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold text-[rgb(var(--ink))]"
            >
              View pipeline
            </Link>
          </div>
        </div>
      </Section>
    </div>
  );
}
