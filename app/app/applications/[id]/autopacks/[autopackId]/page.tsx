import Link from "next/link";
import Section from "@/components/Section";
import { fetchAutopack } from "@/lib/data/autopacks";
import { getSupabaseUser } from "@/lib/data/supabase";
import AutopackEditorForm from "@/app/app/applications/autopack-editor-form";

type AutopackPageProps = {
  params: { id: string; autopackId: string };
};

export default async function AutopackEditorPage({
  params,
}: AutopackPageProps) {
  const { supabase, user } = await getSupabaseUser();

  if (!user) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        Your session expired. Please sign in again.
      </div>
    );
  }

  const autopack = await fetchAutopack(supabase, user.id, params.autopackId);

  if (!autopack || autopack.application_id !== params.id) {
    return (
      <div className="space-y-4">
        <Link
          href={`/app/applications/${params.id}`}
          className="text-sm text-[rgb(var(--muted))]"
        >
          ← Back to application
        </Link>
        <div className="rounded-3xl border border-black/10 bg-white/80 p-6 text-sm text-[rgb(var(--muted))]">
          This autopack was not found or you do not have access.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href={`/app/applications/${params.id}`}
        className="text-sm text-[rgb(var(--muted))]"
      >
        ← Back to application
      </Link>

      <Section
        title={`Autopack v${autopack.version}`}
        description="Edit the CV, cover letter, and STAR answers."
      >
        <AutopackEditorForm autopack={autopack} />
      </Section>
    </div>
  );
}
