import Link from "next/link";
import Section from "@/components/Section";
import { createApplicationAction } from "../actions";
import ApplicationForm from "../application-form";
import { getSupabaseUser } from "@/lib/data/supabase";
import { getEarlyAccessDecision } from "@/lib/early-access";
import EarlyAccessBlock from "@/components/EarlyAccessBlock";

export default async function NewApplicationPage() {
  const { user } = await getSupabaseUser();
  if (!user) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        Your session expired. Please sign in again.
      </div>
    );
  }
  const access = await getEarlyAccessDecision({ userId: user.id, email: user.email });
  if (!access.allowed) {
    return <EarlyAccessBlock email={user.email} reason={access.source} />;
  }

  return (
    <div className="space-y-6">
      <Link href="/app/applications" className="text-sm text-[rgb(var(--muted))]">
        ← Back to applications
      </Link>
      <Section title="New application" description="Capture the job description and tracking status up front.">
        <ApplicationForm mode="create" action={createApplicationAction} />
      </Section>
    </div>
  );
}
