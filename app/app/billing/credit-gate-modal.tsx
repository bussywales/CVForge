"use client";

import Button from "@/components/Button";

type Props = {
  open: boolean;
  onClose: () => void;
  cost: number;
  balance: number;
  actionLabel: string;
  onContinue: () => void;
  onGoBilling?: () => void;
  roiLine?: string;
  recommendedPackName?: string;
  reasons?: string[];
  referralHref?: string;
  subscriptionNudge?: React.ReactNode;
};

export default function CreditGateModal({
  open,
  onClose,
  cost,
  balance,
  actionLabel,
  onContinue,
  onGoBilling,
  roiLine,
  recommendedPackName,
  reasons,
  referralHref,
  subscriptionNudge,
}: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl border border-black/10 bg-white p-5 shadow-xl">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-[rgb(var(--ink))]">
            Top up to continue
          </p>
          <p className="text-xs text-[rgb(var(--muted))]">
            {actionLabel} will use {cost} credit{cost === 1 ? "" : "s"}. Current balance: {balance}
          </p>
          {roiLine ? (
            <p className="text-xs text-[rgb(var(--muted))]">{roiLine}</p>
          ) : null}
          {recommendedPackName ? (
            <p className="text-xs text-[rgb(var(--muted))]">
              Suggested pack: {recommendedPackName}
            </p>
          ) : null}
          {reasons && reasons.length > 0 ? (
            <ul className="list-disc space-y-1 pl-4 text-xs text-[rgb(var(--muted))]">
              {reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          ) : null}
          {referralHref ? (
            <a
              href={referralHref}
              className="text-xs font-semibold text-[rgb(var(--accent-strong))] underline-offset-4 hover:underline"
            >
              Use referral for free credits
            </a>
          ) : null}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" onClick={onContinue}>
            Continue
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={onGoBilling ?? onClose}
          >
            Get credits
          </Button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-black/10 px-4 py-2 text-sm text-[rgb(var(--muted))]"
          >
            Not now
          </button>
        </div>
        {subscriptionNudge ? <div className="mt-3">{subscriptionNudge}</div> : null}
      </div>
    </div>
  );
}
