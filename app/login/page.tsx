"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { createBrowserClient } from "@/lib/supabase/browser";
import { emailSchema } from "@/lib/validators/auth";

export default function LoginPage() {
  const [supabase] = useState(() => createBrowserClient());
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);

  const emailRedirectTo = useMemo(() => {
    const base =
      process.env.NEXT_PUBLIC_SITE_URL ??
      (typeof window !== "undefined" ? window.location.origin : "");
    return `${base.replace(/\/$/, "")}/auth/callback?next=/app`;
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const parsed = emailSchema.safeParse({ email });
    if (!parsed.success) {
      setError("Enter a valid email address.");
      return;
    }

    setStatus("loading");

    const { error: authError } = await supabase.auth.signInWithOtp({
      email: parsed.data.email,
      options: {
        emailRedirectTo,
      },
    });

    if (authError) {
      setError(authError.message);
      setStatus("idle");
      return;
    }

    setStatus("success");
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center px-6 py-16">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(34,94,116,0.16),_transparent_50%)]" />
      <div className="w-full max-w-lg rounded-3xl border border-black/10 bg-white/80 p-8 shadow-xl backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[rgb(var(--muted))]">
              CVForge
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-[rgb(var(--ink))]">
              Sign in with magic link
            </h1>
          </div>
          <Link
            href="/"
            className="text-sm font-medium text-[rgb(var(--accent))]"
          >
            Back home
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-[rgb(var(--ink))]">
              Email address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@company.com"
              className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-[rgb(var(--accent))]"
            />
          </div>
          <button
            type="submit"
            disabled={status === "loading"}
            className="w-full rounded-2xl bg-[rgb(var(--accent))] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[rgb(var(--accent-strong))] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {status === "loading" ? "Sending link..." : "Send magic link"}
          </button>
        </form>

        {status === "success" ? (
          <div className="mt-4 rounded-2xl border border-[rgba(34,94,116,0.2)] bg-[rgba(34,94,116,0.08)] p-4 text-sm text-[rgb(var(--accent-strong))]">
            Check your email.
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : null}
      </div>
    </div>
  );
}
