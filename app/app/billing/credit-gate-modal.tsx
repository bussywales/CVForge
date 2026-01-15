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
};

export default function CreditGateModal({
  open,
  onClose,
  cost,
  balance,
  actionLabel,
  onContinue,
  onGoBilling,
}: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl border border-black/10 bg-white p-5 shadow-xl">
        <p className="text-sm font-semibold text-[rgb(var(--ink))]">
          This will use {cost} credit{cost === 1 ? "" : "s"}
        </p>
        <p className="mt-2 text-xs text-[rgb(var(--muted))]">
          Current balance: {balance} · Action: {actionLabel}
        </p>
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
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
