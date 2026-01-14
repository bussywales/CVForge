"use client";

import { useEffect, useMemo, useState } from "react";

type EvidenceTraceItem = {
  evidenceId?: string;
  gapKey?: string;
  title?: string;
  quality?: number;
  snippet?: string;
};

type EvidenceTrace = {
  cv?: EvidenceTraceItem[];
  cover?: EvidenceTraceItem[];
  star?: EvidenceTraceItem[];
};

type EvidenceSection = {
  key: "cv" | "cover" | "star";
  label: string;
  items: EvidenceTraceItem[];
};

type AutopackEvidenceUsedProps = {
  evidenceTrace: unknown;
};

export default function AutopackEvidenceUsed({
  evidenceTrace,
}: AutopackEvidenceUsedProps) {
  const normalized = useMemo(
    () => normalizeEvidenceTrace(evidenceTrace),
    [evidenceTrace]
  );
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (!copiedId) {
      return;
    }
    const timer = window.setTimeout(() => setCopiedId(null), 2000);
    return () => window.clearTimeout(timer);
  }, [copiedId]);

  const sections: EvidenceSection[] = [
    { key: "cv", label: "CV", items: normalized.cv },
    { key: "cover", label: "Cover", items: normalized.cover },
    { key: "star", label: "STAR", items: normalized.star },
  ];

  const hasEvidence =
    normalized.cv.length + normalized.cover.length + normalized.star.length > 0;

  const handleCopy = async (value: string, id: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedId(id);
    } catch (error) {
      console.error("[autopack.evidence.copy]", error);
    }
  };

  return (
    <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
        Evidence used in this pack
      </p>
      {!hasEvidence ? (
        <p className="mt-3 text-xs text-[rgb(var(--muted))]">
          No evidence was recorded for this autopack.
        </p>
      ) : (
        <div className="mt-3 space-y-4">
          {sections.map((section) => (
            <div key={section.key} className="space-y-2">
              <p className="text-[11px] uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
                {section.label}
              </p>
              {section.items.length ? (
                <ul className="space-y-2 text-xs text-[rgb(var(--muted))]">
                  {section.items.map((item) => {
                    const snippet = item.snippet?.trim() ?? "";
                    const shortSnippet = snippet.length > 160
                      ? `${snippet.slice(0, 157).trim()}...`
                      : snippet;
                    const itemId = `${section.key}:${item.evidenceId ?? item.title ?? "item"}`;
                    return (
                      <li
                        key={itemId}
                        className="rounded-xl border border-black/10 bg-white/70 p-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-[rgb(var(--ink))]">
                            {item.title ?? "Evidence item"}
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            {item.gapKey ? (
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                                {item.gapKey}
                              </span>
                            ) : null}
                            {typeof item.quality === "number" ? (
                              <span className="rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                                Quality {item.quality}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        {shortSnippet ? (
                          <p className="mt-1 text-xs text-[rgb(var(--muted))]">
                            {shortSnippet}
                          </p>
                        ) : null}
                        {snippet ? (
                          <div className="mt-2">
                            <button
                              type="button"
                              onClick={() => handleCopy(snippet, itemId)}
                              className="rounded-full border border-black/10 bg-white px-2 py-0.5 text-[11px] font-semibold text-[rgb(var(--ink))] transition hover:bg-white"
                            >
                              {copiedId === itemId ? "Copied" : "Copy"}
                            </button>
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-xs text-[rgb(var(--muted))]">No evidence.</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function normalizeEvidenceTrace(input: unknown): {
  cv: EvidenceTraceItem[];
  cover: EvidenceTraceItem[];
  star: EvidenceTraceItem[];
} {
  if (!input || typeof input !== "object") {
    return { cv: [], cover: [], star: [] };
  }
  const trace = input as EvidenceTrace;
  return {
    cv: Array.isArray(trace.cv) ? trace.cv : [],
    cover: Array.isArray(trace.cover) ? trace.cover : [],
    star: Array.isArray(trace.star) ? trace.star : [],
  };
}
