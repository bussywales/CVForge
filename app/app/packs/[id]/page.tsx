import Link from "next/link";
import EarlyAccessBlock from "@/components/EarlyAccessBlock";
import { getSupabaseUser } from "@/lib/data/supabase";
import { getEarlyAccessDecision } from "@/lib/early-access";
import { fetchApplicationPack, listPackVersions } from "@/lib/packs/packs-store";
import PackDetailClient from "./pack-detail-client";

export default async function PackDetailPage({ params }: { params: { id: string } }) {
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

  const pack = await fetchApplicationPack({ supabase, userId: user.id, packId: params.id });
  if (!pack) {
    return (
      <div className="rounded-3xl border border-black/10 bg-white/80 p-6 text-sm text-[rgb(var(--muted))]">
        Pack not found.{" "}
        <Link href="/app/packs" className="font-semibold text-[rgb(var(--ink))] underline">
          Back to packs
        </Link>
      </div>
    );
  }

  const versions = await listPackVersions({ supabase, userId: user.id, packId: params.id, limit: 20 });

  return (
    <PackDetailClient
      initialPack={pack}
      initialVersions={versions}
    />
  );
}
