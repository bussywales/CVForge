import Link from "next/link";

import CopyIconButton from "@/components/CopyIconButton";

export default function ReferralCta({ code }: { code?: string | null }) {
  if (!code) return null;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const inviteUrl = `${siteUrl.replace(/\/$/, "")}/auth/signup?ref=${code}`;
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
      <p className="font-semibold">Invite a friend, earn +3 credits</p>
      <p className="text-[11px] text-amber-700">
        Share this link. You and your friend both get credits on signup.
      </p>
      <p className="mt-2 break-all rounded-lg border border-amber-200 bg-white px-3 py-2 text-[13px] text-[rgb(var(--ink))]">
        {inviteUrl}
      </p>
      <CopyIconButton text={inviteUrl} className="mt-2" iconOnly />
      <Link
        href="/app/billing"
        className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-amber-800 underline-offset-2 hover:underline"
      >
        View referral details →
      </Link>
    </div>
  );
}
