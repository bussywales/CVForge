type InviteProfile = {
  invite_id?: string | null;
  invite_source?: string | null;
  invited_at?: string | null;
  invited_email_hash?: string | null;
} | null;

export default function InviteAttribution({ profile }: { profile: InviteProfile }) {
  if (!profile) return null;
  return (
    <div className="rounded-2xl border border-black/10 bg-white/80 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-[rgb(var(--ink))]">Invite attribution</p>
        <a className="text-xs text-[rgb(var(--muted))] underline" href="/app/ops/funnel">
          Open funnel
        </a>
      </div>
      <div className="mt-2 grid gap-2 text-xs text-[rgb(var(--muted))] md:grid-cols-2">
        <span>Invite ID: {profile.invite_id ? String(profile.invite_id).slice(0, 8) : "—"}</span>
        <span>Source: {profile.invite_source ?? "unknown"}</span>
        <span>Invited at: {profile.invited_at ?? "—"}</span>
        <span>Email hash: {profile.invited_email_hash ? `hash:${String(profile.invited_email_hash).slice(0, 8)}` : "—"}</span>
      </div>
    </div>
  );
}
