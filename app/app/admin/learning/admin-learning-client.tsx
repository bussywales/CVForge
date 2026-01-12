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

type EditableSignal = {
  id: string;
  label: string;
  weight: number;
  aliasesText: string;
  gapSuggestions: string[];
  metricSnippets: string[];
};

export default function AdminLearningClient({
  proposals,
}: AdminLearningClientProps) {
  const router = useRouter();
  const [toast, setToast] = useState<ToastState | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const emptyState = proposals.length === 0;

  const handleAction = async (
    endpoint: string,
    proposalId: string,
    actionLabel: string
  ) => {
    setPendingId(proposalId);
    setPendingAction(actionLabel);
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
      setPendingAction(null);
    }
  };

  const handleSaveEdits = async (
    proposalId: string,
    title: string,
    signals: EditableSignal[]
  ) => {
    setPendingId(proposalId);
    setPendingAction("save");
    try {
      const response = await fetch("/api/admin/packs/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposalId, title, signals }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setToast({
          message: payload?.error ?? "Unable to save edits right now.",
        });
        return;
      }
      setToast({ message: "Proposal updated." });
      router.refresh();
    } catch (error) {
      console.error("[admin.learning.save]", error);
      setToast({ message: "Unable to save edits right now." });
    } finally {
      setPendingId(null);
      setPendingAction(null);
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
              pendingAction={pendingAction}
              onPublish={() =>
                handleAction("/api/admin/packs/publish", proposal.id, "publish")
              }
              onReject={() =>
                handleAction("/api/admin/packs/reject", proposal.id, "reject")
              }
              onSaveEdits={(title, signals) =>
                handleSaveEdits(proposal.id, title, signals)
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
  pendingAction: string | null;
  onPublish: () => void;
  onReject: () => void;
  onSaveEdits: (title: string, signals: EditableSignal[]) => void;
};

function ProposalCard({
  proposal,
  pending,
  pendingAction,
  onPublish,
  onReject,
  onSaveEdits,
}: ProposalCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const initialSignals = useMemo(
    () => parseSignals(proposal.signals),
    [proposal.signals]
  );
  const [title, setTitle] = useState(proposal.title);
  const [signals, setSignals] = useState<EditableSignal[]>(initialSignals);

  useEffect(() => {
    setTitle(proposal.title);
    setSignals(initialSignals);
  }, [proposal.title, initialSignals]);

  const preview = useMemo(() => buildPreview(signals), [signals]);
  const createdAt = proposal.created_at
    ? DATE_FORMAT.format(new Date(proposal.created_at))
    : "";

  return (
    <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[rgb(var(--ink))]">
            {title}
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
        <div className="mt-4 rounded-2xl border border-black/10 bg-white/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
              Edit proposal
            </p>
            <button
              type="button"
              onClick={() => setIsEditing((prev) => !prev)}
              className="text-xs font-semibold text-[rgb(var(--ink))] underline-offset-2 hover:underline"
            >
              {isEditing ? "Close" : "Edit"}
            </button>
          </div>

          {isEditing ? (
            <div className="mt-4 space-y-4">
              <label className="block text-xs font-semibold text-[rgb(var(--muted))]">
                Pack title
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm text-[rgb(var(--ink))]"
                />
              </label>

              <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
                  Signals (aliases + weight)
                </p>
                {signals.map((signal, index) => (
                  <div
                    key={signal.id}
                    className="grid gap-2 rounded-2xl border border-black/10 bg-white/80 p-3 md:grid-cols-[1fr_auto]"
                  >
                    <div>
                      <p className="text-sm font-semibold text-[rgb(var(--ink))]">
                        {signal.label}
                      </p>
                      <label className="mt-2 block text-xs text-[rgb(var(--muted))]">
                        Aliases (comma separated)
                        <input
                          value={signal.aliasesText}
                          onChange={(event) => {
                            const value = event.target.value;
                            setSignals((prev) => {
                              const next = [...prev];
                              next[index] = { ...next[index], aliasesText: value };
                              return next;
                            });
                          }}
                          className="mt-1 w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-xs text-[rgb(var(--ink))]"
                        />
                      </label>
                    </div>
                    <label className="text-xs text-[rgb(var(--muted))]">
                      Weight
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={signal.weight}
                        onChange={(event) => {
                          const value = Number.parseInt(event.target.value, 10);
                          setSignals((prev) => {
                            const next = [...prev];
                            next[index] = {
                              ...next[index],
                              weight: Number.isFinite(value) ? value : 1,
                            };
                            return next;
                          });
                        }}
                        className="mt-1 w-20 rounded-2xl border border-black/10 bg-white px-3 py-2 text-xs text-[rgb(var(--ink))]"
                      />
                    </label>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => onSaveEdits(title, signals)}
                  disabled={pending}
                >
                  {pending && pendingAction === "save"
                    ? "Saving..."
                    : "Save edits"}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {proposal.status === "pending" ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" onClick={onPublish} disabled={pending}>
            {pending && pendingAction === "publish"
              ? "Publishing..."
              : "Approve + publish"}
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={onReject}
            disabled={pending}
          >
            {pending && pendingAction === "reject" ? "Updating..." : "Reject"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function parseSignals(raw: unknown): EditableSignal[] {
  const rawSignals =
    raw && typeof raw === "object" && "signals" in raw
      ? (raw as { signals?: unknown }).signals
      : raw;
  if (!Array.isArray(rawSignals)) {
    return [];
  }

  return rawSignals
    .map((signal) => {
      if (!signal || typeof signal !== "object") {
        return null;
      }
      const s = signal as {
        id?: string;
        label?: string;
        weight?: number;
        aliases?: string[];
        gapSuggestions?: string[];
        metricSnippets?: string[];
      };
      if (!s.id || !s.label) {
        return null;
      }
      return {
        id: s.id,
        label: s.label,
        weight: Number.isFinite(s.weight) ? (s.weight as number) : 3,
        aliasesText: Array.isArray(s.aliases) ? s.aliases.join(", ") : "",
        gapSuggestions: Array.isArray(s.gapSuggestions) ? s.gapSuggestions : [],
        metricSnippets: Array.isArray(s.metricSnippets) ? s.metricSnippets : [],
      };
    })
    .filter(Boolean) as EditableSignal[];
}

function buildPreview(signals: EditableSignal[]) {
  try {
    const payload = signals.map((signal) => ({
      id: signal.id,
      label: signal.label,
      weight: signal.weight,
      aliases: signal.aliasesText
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
      gapSuggestions: signal.gapSuggestions,
      metricSnippets: signal.metricSnippets,
    }));
    const text = JSON.stringify(payload ?? [], null, 2);
    if (text.length > 2000) {
      return `${text.slice(0, 2000)}\n...`;
    }
    return text;
  } catch {
    return "Unable to render signals.";
  }
}
