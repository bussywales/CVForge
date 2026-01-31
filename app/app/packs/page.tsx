import Section from "@/components/Section";
import EarlyAccessBlock from "@/components/EarlyAccessBlock";
import { getSupabaseUser } from "@/lib/data/supabase";
import { getEarlyAccessDecision } from "@/lib/early-access";
import { listApplicationPacks } from "@/lib/packs/packs-store";
import PacksClient from "./packs-client";

export default async function PacksPage() {
  const { supabase, user } = await getSupabaseUser();

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

  const packs = await listApplicationPacks({ supabase, userId: user.id, limit: 24 });

  return (
    <Section
      title="Application Packs"
      description="Generate tailored CV + cover letter bundles with evidence and fit mapping."
    >
      <PacksClient initialPacks={packs} />
    </Section>
  );
}
