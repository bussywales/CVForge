"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/Button";

const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
});

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

type AdminLearningClientProps = {
  proposals: ProposalRecord[];
};

type ToastState = {
  message: string;
};

export default function AdminLearningClient({
  proposals,
}: AdminLearningClientProps) {
  const router = useRouter();
  const [toast, setToast] = useState<ToastState | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const emptyState = proposals.length === 0;

  const handleAction = async (endpoint: string, proposalId: string) => {
    setPendingId(proposalId);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposalId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setToast({
          message: payload?.error ?? "Unable to update the proposal right now.",
        });
        return;
      }
      setToast({
        message:
          endpoint.includes("publish")
            ? "Pack published."
            : "Proposal rejected.",
      });
      router.refresh();
    } catch (error) {
      console.error("[admin.learning.action]", error);
      setToast({ message: "Unable to update the proposal right now." });
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {toast ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {toast.message}
        </div>
      ) : null}

      {emptyState ? (
        <div className="rounded-2xl border border-dashed border-black/10 bg-white/60 p-4 text-sm text-[rgb(var(--muted))]">
          No learning proposals yet.
        </div>
      ) : (
        <div className="space-y-4">
          {proposals.map((proposal) => (
            <ProposalCard
              key={proposal.id}
              proposal={proposal}
              pending={pendingId === proposal.id}
              onPublish={() =>
                handleAction("/api/admin/packs/publish", proposal.id)
              }
              onReject={() =>
                handleAction("/api/admin/packs/reject", proposal.id)
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

type ProposalCardProps = {
  proposal: ProposalRecord;
  pending: boolean;
  onPublish: () => void;
  onReject: () => void;
};

function ProposalCard({ proposal, pending, onPublish, onReject }: ProposalCardProps) {
  const preview = useMemo(() => buildPreview(proposal.signals), [proposal.signals]);
  const createdAt = proposal.created_at
    ? DATE_FORMAT.format(new Date(proposal.created_at))
    : "";

  return (
    <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[rgb(var(--ink))]">
            {proposal.title}
          </p>
          <p className="mt-1 text-xs text-[rgb(var(--muted))]">
            Domain: {proposal.domain_guess} · Occurrences: {proposal.occurrences}
            {createdAt ? ` · ${createdAt}` : ""}
          </p>
        </div>
        <span
          className={`rounded-full border px-3 py-1 text-xs font-semibold ${
            proposal.status === "approved"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : proposal.status === "rejected"
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-amber-200 bg-amber-50 text-amber-700"
          }`}
        >
          {proposal.status}
        </span>
      </div>

      {proposal.source_terms?.length ? (
        <div className="mt-3">
          <p className="text-[11px] uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
            Sample terms
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {proposal.source_terms.slice(0, 16).map((term) => (
              <span
                key={term}
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600"
              >
                {term}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-4">
        <p className="text-[11px] uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
          Signals JSON preview
        </p>
        <pre className="mt-2 max-h-64 overflow-auto rounded-2xl border border-black/10 bg-black/95 p-3 text-xs text-white/80">
          {preview}
        </pre>
      </div>

      {proposal.status === "pending" ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" onClick={onPublish} disabled={pending}>
            {pending ? "Publishing..." : "Approve + publish"}
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={onReject}
            disabled={pending}
          >
            {pending ? "Updating..." : "Reject"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function buildPreview(signals: unknown) {
  try {
    const text = JSON.stringify(signals ?? [], null, 2);
    if (text.length > 2000) {
      return `${text.slice(0, 2000)}\n...`;
    }
    return text;
  } catch {
    return "Unable to render signals.";
  }
}
