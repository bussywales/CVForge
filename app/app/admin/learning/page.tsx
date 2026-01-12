import Section from "@/components/Section";
import { getSupabaseUser } from "@/lib/data/supabase";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { isAdminEmail } from "@/lib/admin";
import AdminLearningClient from "./admin-learning-client";

export const dynamic = "force-dynamic";

type ProposalRecord = {
  id: string;
  domain_guess: string;
  title: string;
  signals: unknown;
  source_terms: string[];
  occurrences: number;
  status: string;
  created_at: string;
  updated_at: string;
};

export default async function AdminLearningPage() {
  const { user } = await getSupabaseUser();

  if (!user) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        Your session expired. Please sign in again.
      </div>
    );
  }

  if (!isAdminEmail(user.email)) {
    return (
      <div className="rounded-3xl border border-black/10 bg-white/80 p-6 text-sm text-[rgb(var(--muted))]">
        Admin access only.
      </div>
    );
  }

  let proposals: ProposalRecord[] = [];
  let errorMessage = "";

  try {
    const service = createServiceRoleClient();
    const { data, error } = await service
      .from("domain_pack_proposals")
      .select(
        "id, domain_guess, title, signals, source_terms, occurrences, status, created_at, updated_at"
      )
      .order("occurrences", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    proposals = (data ?? []) as ProposalRecord[];
  } catch (error) {
    console.error("[admin.learning]", error);
    errorMessage = "Unable to load proposals right now.";
  }

  return (
    <Section
      title="Learning inbox"
      description="Review anonymised job advert signals and publish new Role Fit packs."
    >
      {errorMessage ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : (
        <AdminLearningClient proposals={proposals} />
      )}
    </Section>
  );
}
