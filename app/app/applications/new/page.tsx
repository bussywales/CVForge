import Link from "next/link";
import Section from "@/components/Section";
import { createApplicationAction } from "../actions";
import ApplicationForm from "../application-form";

export default function NewApplicationPage() {
  return (
    <div className="space-y-6">
      <Link href="/app/applications" className="text-sm text-[rgb(var(--muted))]">
        ← Back to applications
      </Link>
      <Section
        title="New application"
        description="Capture the job description and tracking status up front."
      >
        <ApplicationForm mode="create" action={createApplicationAction} />
      </Section>
    </div>
  );
}
