"use client";

import { useState } from "react";
import Link from "next/link";
import Button from "@/components/Button";

type GapSignal = {
  id: string;
  label: string;
};

type StarDraftSummary = {
  id: string;
  gap_key: string;
  title: string;
  updated_at: string | null;
};

type StarLibraryPanelProps = {
  applicationId: string;
  gaps: GapSignal[];
  drafts: StarDraftSummary[];
  starEvidenceCount: number;
};

export default function StarLibraryPanel({
  applicationId,
  gaps,
  drafts,
  starEvidenceCount,
}: StarLibraryPanelProps) {
  const [draftsByGap, setDraftsByGap] = useState<Record<string, StarDraftSummary>>(
    () =>
      drafts.reduce((acc, draft) => {
        acc[draft.gap_key] = draft;
        return acc;
      }, {} as Record<string, StarDraftSummary>)
  );
  const [pendingGap, setPendingGap] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async (gap: GapSignal) => {
    setError(null);
    setPendingGap(gap.id);
    try {
      const response = await fetch("/api/star-library/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          applicationId,
          gapKey: gap.id,
          title: gap.label,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload?.error ?? "Unable to create the draft.");
        return;
      }
      const draft = payload?.draft as StarDraftSummary | undefined;
      if (draft) {
        setDraftsByGap((prev) => ({
          ...prev,
          [gap.id]: draft,
        }));
      }
    } catch (fetchError) {
      console.error("[star-library.create]", fetchError);
      setError("Unable to create the draft.");
    } finally {
      setPendingGap(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-black/10 bg-white/70 p-3 text-xs text-[rgb(var(--muted))]">
        STAR-target evidence selected:{" "}
        <span className="font-semibold text-[rgb(var(--ink))]">
          {starEvidenceCount}
        </span>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {error}
        </div>
      ) : null}

      <div className="space-y-3">
        {gaps.map((gap) => {
          const draft = draftsByGap[gap.id];
          return (
            <div
              key={gap.id}
              className="rounded-2xl border border-black/10 bg-white/80 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[rgb(var(--ink))]">
                    {gap.label}
                  </p>
                  <p className="mt-1 text-xs text-[rgb(var(--muted))]">
                    {draft ? "Draft ready" : "No draft yet"}
                  </p>
                </div>
                {draft ? (
                  <Link
                    href={`/app/applications/${applicationId}/star/${encodeURIComponent(gap.id)}`}
                    className="inline-flex items-center justify-center rounded-2xl border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-[rgb(var(--ink))]"
                  >
                    Open
                  </Link>
                ) : (
                  <Button
                    type="button"
                    onClick={() => handleCreate(gap)}
                    disabled={pendingGap === gap.id || starEvidenceCount === 0}
                  >
                    {pendingGap === gap.id ? "Creating..." : "Create STAR draft"}
                  </Button>
                )}
              </div>
              {!draft && starEvidenceCount === 0 ? (
                <p className="mt-3 text-xs text-[rgb(var(--muted))]">
                  Select STAR-target evidence first to create a draft.
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
