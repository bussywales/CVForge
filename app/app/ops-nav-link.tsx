"use client";

import Link from "next/link";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";

export default function OpsNavLink() {
  const handleClick = () => {
    try {
      logMonetisationClientEvent("ops_entry_click", null, "ops", { from: "nav" });
    } catch {
      // ignore
    }
  };

  return (
    <Link
      href="/app/ops"
      onClick={handleClick}
      className="rounded-full border border-black/10 bg-white/70 px-4 py-2 font-medium text-[rgb(var(--ink))] transition hover:border-black/20"
    >
      Ops Console
    </Link>
  );
}
