"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import ErrorBanner from "@/components/ErrorBanner";

type UserRow = {
  id: string;
  email: string | null;
  createdAt: string | null;
  name?: string | null;
  role?: string | null;
};

type SearchError = { message?: string | null; requestId?: string | null; code?: string | null };

export default function UserLookupClient({ initialQuery = "" }: { initialQuery?: string }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<SearchError | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [touched, setTouched] = useState(Boolean(initialQuery));

  const hasResults = users.length > 0;

  const handleFocus = () => {
    inputRef.current?.focus();
    sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    const listener = () => handleFocus();
    if (typeof window !== "undefined") {
      window.addEventListener("ops-focus-user-lookup", listener);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("ops-focus-user-lookup", listener);
      }
    };
  }, []);

  const runSearch = async (forcedQuery?: string) => {
    const q = (forcedQuery ?? query).trim();
    if (q.length < 3) {
      setError({ message: "Enter at least 3 characters", code: "BAD_INPUT" });
      setUsers([]);
      return;
    }
    setTouched(true);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/ops/users/search?q=${encodeURIComponent(q)}`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      const requestId = res.headers.get("x-request-id");
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError({
          message: data?.error?.message ?? "Unable to search right now.",
          requestId: data?.error?.requestId ?? requestId,
          code: data?.error?.code,
        });
        setUsers([]);
        return;
      }
      setUsers((data.users ?? []) as UserRow[]);
    } catch {
      setError({ message: "Unable to search right now.", code: "NETWORK" });
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialQuery) {
      runSearch(initialQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    runSearch();
  };

  const createdFormatter = useMemo(
    () => new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric" }),
    []
  );

  return (
    <div ref={sectionRef} className="space-y-3" id="ops-user-lookup">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-[rgb(var(--ink))]">User lookup</p>
          <p className="text-xs text-[rgb(var(--muted))]">Search by email or user id</p>
        </div>
        <button
          type="button"
          onClick={handleFocus}
          className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-[rgb(var(--ink))]"
        >
          Focus search
        </button>
      </div>
      {error ? (
        <ErrorBanner
          title="Search failed"
          message={error.message ?? "Unable to search right now."}
          requestId={error.requestId ?? undefined}
        />
      ) : null}
      <form onSubmit={handleSubmit} className="space-y-2">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Email or user id"
          className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm"
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={loading}
            className="rounded-full bg-[rgb(var(--ink))] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-black/30"
          >
            {loading ? "Searching..." : "Search"}
          </button>
          {touched ? <p className="text-[10px] text-[rgb(var(--muted))]">Press Enter to search</p> : null}
        </div>
      </form>
      {!loading && touched && !hasResults && !error ? (
        <p className="text-xs text-[rgb(var(--muted))]">No user found.</p>
      ) : null}
      {hasResults ? (
        <div className="overflow-x-auto rounded-2xl border border-black/10 bg-white/80">
          <table className="min-w-full text-left text-xs text-[rgb(var(--muted))]">
            <thead className="text-[10px] uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">User ID</th>
                <th className="px-3 py-2">Created</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-black/5">
                  <td className="px-3 py-2 text-[rgb(var(--ink))]">{u.name ?? "—"}</td>
                  <td className="px-3 py-2 text-[rgb(var(--ink))]">{u.email ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-[10px] text-[rgb(var(--muted))]">{u.id}</td>
                  <td className="px-3 py-2">{u.createdAt ? createdFormatter.format(new Date(u.createdAt)) : "—"}</td>
                  <td className="px-3 py-2">{u.role ?? "—"}</td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      href={`/app/ops/users/${u.id}`}
                      className="rounded-full border border-black/10 bg-[rgb(var(--ink))] px-3 py-1 text-[11px] font-semibold text-white"
                    >
                      Open dossier
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
