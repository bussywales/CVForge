"use client";

import { useState } from "react";
import Link from "next/link";
import type { FollowupItem } from "@/lib/outreach-autopilot";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";
import FollowupModal from "./followup-modal";

type Props = {
  items: FollowupItem[];
  surface: "dashboard" | "applications";
};

export default function FollowupsDueStrip({ items, surface }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [completed, setCompleted] = useState<Record<string, boolean>>({});

  if (!items.length) return null;

  const openModal = (id: string) => {
    setOpenId(id);
    logMonetisationClientEvent("followups_strip_send_click", id, surface);
  };

  const closeModal = () => setOpenId(null);

  return (
    <div className="rounded-3xl border border-black/10 bg-white/70 p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">Follow-ups due today</p>
        <span className="text-[10px] text-[rgb(var(--muted))]">{items.length} due</span>
      </div>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-black/10 bg-white px-3 py-2"
          >
            <div>
              <p className="text-sm font-semibold text-[rgb(var(--ink))]">
                {item.role} · {item.company}
              </p>
              <p className="text-[11px] uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
                {item.dueLabel}
                {item.isRecovery ? " · Recovery" : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-full bg-[rgb(var(--ink))] px-3 py-1 text-[10px] font-semibold text-white"
                onClick={() => openModal(item.id)}
                disabled={completed[item.id]}
              >
                {item.contactEmail || item.contactLinkedin ? "Send + log" : "Add contact"}
              </button>
              <Link href={item.href} className="text-[10px] font-semibold text-[rgb(var(--accent-strong))] underline-offset-2 hover:underline">
                Open
              </Link>
            </div>
            {openId === item.id ? (
              <FollowupModal
                item={item}
                onClose={closeModal}
                onLogged={() => setCompleted((prev) => ({ ...prev, [item.id]: true }))}
              />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
