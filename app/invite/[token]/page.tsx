import Link from "next/link";
import InviteLandingClient from "@/components/InviteLandingClient";
import { getSupabaseUser } from "@/lib/data/supabase";

export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: { params: { token: string } }) {
  const token = params.token;
  const { user } = await getSupabaseUser();
  return (
    <div className="flex min-h-screen items-center justify-center bg-[rgba(255,255,255,0.6)] px-6 py-12">
      <div className="w-full max-w-lg space-y-6 rounded-3xl border border-black/10 bg-white/80 p-8 text-center shadow-lg">
        <p className="text-xs uppercase tracking-[0.3em] text-[rgb(var(--muted))]">Invite</p>
        <InviteLandingClient token={token} isAuthed={Boolean(user)} />
        <Link href="/" className="text-xs text-[rgb(var(--muted))] underline">
          Back to home
        </Link>
      </div>
    </div>
  );
}
