"use client";

import Link from "next/link";

export default function QuickLinksClient() {
  const focusSearch = () => {
    if (typeof window === "undefined") return;
    const event = new CustomEvent("ops-focus-user-lookup");
    window.dispatchEvent(event);
    const el = document.getElementById("ops-user-lookup");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Link
        href="/app/ops/incidents"
        className="rounded-2xl border border-black/10 bg-white/80 px-4 py-3 text-sm font-semibold text-[rgb(var(--ink))] transition hover:border-black/20"
      >
        Open Incidents
        <p className="mt-1 text-xs font-normal text-[rgb(var(--muted))]">Request ID lookup & recent errors</p>
      </Link>
      <button
        type="button"
        onClick={focusSearch}
        className="rounded-2xl border border-black/10 bg-white/80 px-4 py-3 text-left text-sm font-semibold text-[rgb(var(--ink))] transition hover:border-black/20"
      >
        User lookup
        <p className="mt-1 text-xs font-normal text-[rgb(var(--muted))]">Search by email or user id</p>
      </button>
      <Link
        href="/app/ops/audits"
        className="rounded-2xl border border-black/10 bg-white/80 px-4 py-3 text-sm font-semibold text-[rgb(var(--ink))] transition hover:border-black/20"
      >
        Audits
        <p className="mt-1 text-xs font-normal text-[rgb(var(--muted))]">Review ops actions with filters/export</p>
      </Link>
    </div>
  );
}
