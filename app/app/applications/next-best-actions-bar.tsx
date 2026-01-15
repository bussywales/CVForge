"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Button from "@/components/Button";
import type { NextBestAction } from "@/lib/next-best-actions";

type NextBestActionsBarProps = {
  applicationId: string;
  actions: NextBestAction[];
};

export default function NextBestActionsBar({
  applicationId,
  actions,
}: NextBestActionsBarProps) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const key = `cvforge:app:${applicationId}:nbaCollapsed`;
    const saved =
      typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
    if (saved) {
      setCollapsed(saved === "true");
    }
  }, [applicationId]);

  const toggle = () => {
    const key = `cvforge:app:${applicationId}:nbaCollapsed`;
    setCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        window.localStorage.setItem(key, String(next));
      }
      return next;
    });
  };

  const hasActions = actions.length > 0;

  const fallbackAction: NextBestAction = {
    id: "review-kit",
    label: "Review Application Kit",
    why: "Everything looks good; keep the kit ready.",
    href: `/app/applications/${applicationId}?tab=apply#kit`,
  };

  const items = hasActions ? actions : [fallbackAction];

  return (
    <div className="sticky top-0 z-10 rounded-2xl border border-black/10 bg-white/90 p-3 shadow-sm backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
            Next best actions
          </p>
          <p className="text-xs text-[rgb(var(--muted))]">
            {hasActions ? "Up to 3 quick wins" : "All set—keep the kit fresh."}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          className="px-2 py-1 text-xs"
          onClick={toggle}
        >
          {collapsed ? "Show" : "Hide"}
        </Button>
      </div>
      {!collapsed ? (
        <div className="mt-3 grid gap-2 lg:grid-cols-3">
          {items.map((action) => (
            <div
              key={action.id}
              className="rounded-xl border border-dashed border-black/10 bg-white/80 p-3"
            >
              <p className="text-sm font-semibold text-[rgb(var(--ink))]">
                {action.label}
              </p>
              <p className="mt-1 text-xs text-[rgb(var(--muted))]">
                {action.why}
              </p>
              <div className="mt-2">
                <Link
                  href={action.href}
                  className="inline-flex items-center rounded-full border border-black/10 bg-white px-3 py-1 text-[10px] font-semibold text-[rgb(var(--ink))]"
                >
                  Go
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
