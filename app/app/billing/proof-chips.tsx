"use client";

import { useState } from "react";

type Props = {
  reasons: string[];
};

const ICONS = ["•", "✓", "↗️", "→"];

export default function ProofChips({ reasons }: Props) {
  const [open, setOpen] = useState(false);
  const top = reasons.slice(0, 3);
  const rest = reasons.slice(3);

  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {top.map((reason, idx) => (
          <span
            key={reason}
            className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-[rgb(var(--ink))] shadow-sm"
          >
            <span>{ICONS[idx % ICONS.length]}</span>
            {reason}
          </span>
        ))}
        {rest.length > 0 ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-[rgb(var(--ink))] hover:bg-slate-50"
          >
            {open ? "Hide details" : "See details"}
          </button>
        ) : null}
      </div>
      {open ? (
        <div className="flex flex-wrap items-center gap-2">
          {rest.map((reason, idx) => (
            <span
              key={reason}
              className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-700"
            >
              <span>{ICONS[(idx + top.length) % ICONS.length]}</span>
              {reason}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
