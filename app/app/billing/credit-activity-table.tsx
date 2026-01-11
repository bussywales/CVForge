"use client";

import { useEffect, useState } from "react";

type CreditActivityRow = {
  id: string;
  createdLabel: string;
  deltaLabel: string;
  deltaTone: "positive" | "negative" | "neutral";
  reasonLabel: string;
  refShort: string;
  ref?: string | null;
};

type CreditActivityTableProps = {
  rows: CreditActivityRow[];
};

const deltaToneStyles: Record<CreditActivityRow["deltaTone"], string> = {
  positive: "border-emerald-200 bg-emerald-50 text-emerald-700",
  negative: "border-rose-200 bg-rose-50 text-rose-700",
  neutral: "border-slate-200 bg-slate-50 text-slate-600",
};

export default function CreditActivityTable({ rows }: CreditActivityTableProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (!copiedId) {
      return;
    }

    const timer = window.setTimeout(() => {
      setCopiedId(null);
    }, 2000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [copiedId]);

  const handleCopy = async (rowId: string, ref?: string | null) => {
    if (!ref) {
      return;
    }

    try {
      await navigator.clipboard.writeText(ref);
      setCopiedId(rowId);
    } catch (error) {
      console.error("[billing.copy_ref]", error);
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-black/10 bg-white/70">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-white/80 text-[11px] uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
          <tr className="border-b border-black/10">
            <th className="px-4 py-3 font-medium">Date</th>
            <th className="px-4 py-3 font-medium">Delta</th>
            <th className="px-4 py-3 font-medium">Reason</th>
            <th className="px-4 py-3 font-medium">Ref</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-black/5">
          {rows.map((row) => (
            <tr key={row.id} className="align-top">
              <td className="px-4 py-3 text-sm text-[rgb(var(--ink))]">
                {row.createdLabel}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${deltaToneStyles[row.deltaTone]}`}
                >
                  {row.deltaLabel}
                </span>
              </td>
              <td className="px-4 py-3 text-sm text-[rgb(var(--ink))]">
                {row.reasonLabel}
              </td>
              <td className="px-4 py-3 text-xs text-[rgb(var(--muted))]">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="font-mono text-[11px]"
                    title={row.ref ?? ""}
                  >
                    {row.refShort}
                  </span>
                  {row.ref ? (
                    <button
                      type="button"
                      onClick={() => handleCopy(row.id, row.ref)}
                      className="rounded-full border border-black/10 bg-white/80 px-2 py-0.5 text-[11px] font-semibold text-[rgb(var(--ink))] transition hover:bg-white"
                    >
                      {copiedId === row.id ? "Copied" : "Copy ref"}
                    </button>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
