"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createBrowserClient } from "@/lib/supabase/browser";

export default function LogoutButton() {
  const router = useRouter();
  const [supabase] = useState(() => createBrowserClient());
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className="rounded-full border border-black/10 bg-white/70 px-4 py-2 text-sm font-medium text-[rgb(var(--ink))] transition hover:border-black/20 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {loading ? "Signing out..." : "Log out"}
    </button>
  );
}
