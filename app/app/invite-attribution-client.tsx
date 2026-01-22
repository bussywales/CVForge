"use client";

import { useEffect } from "react";

export default function InviteAttributionClient() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("invite") || localStorage.getItem("cvf_invite_token");
    if (!token) return;
    const claim = async () => {
      try {
        const res = await fetch("/api/invite/claim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const body = await res.json().catch(() => null);
        if (body?.ok) {
          localStorage.removeItem("cvf_invite_token");
        }
      } catch {
        // ignore
      }
    };
    claim();
  }, []);

  return null;
}
