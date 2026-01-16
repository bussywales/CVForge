"use client";

import { useState } from "react";

type Props = {
  reasons: string[];
};

export default function SeeMoreChips({ reasons }: Props) {
  const [open, setOpen] = useState(false);
  if (reasons.length <= 3) return null;
  return (
    <>
      <button
        type="button"
        className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-[rgb(var(--ink))]"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "Hide details" : "See details"}
      </button>
      {open ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {reasons.slice(3).map((reason) => (
            <span
              key={reason}
              className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-700"
            >
              {reason}
            </span>
          ))}
        </div>
      ) : null}
    </>
  );
}
