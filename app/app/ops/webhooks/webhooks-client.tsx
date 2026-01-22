"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";

type Failure = Awaited<ReturnType<typeof import("@/lib/ops/webhook-failures").listWebhookFailures>>["items"][number];

type Props = {
  initialItems: Failure[];
  initialNextCursor: string | null;
};

type SinceFilter = "1h" | "24h" | "7d";
type ChipFilter = "none" | "repeating" | "last24";

export default function WebhooksClient({ initialItems, initialNextCursor }: Props) {
  const [since, setSince] = useState<SinceFilter>("24h");
  const [code, setCode] = useState("");
  const [q, setQ] = useState("");
  const [userId, setUserId] = useState("");
  const [items, setItems] = useState<Failure[]>(initialItems);
  const [cursor, setCursor] = useState<string | null>(initialNextCursor);
  const [loading, setLoading] = useState(false);
  const [chip, setChip] = useState<ChipFilter>("none");
  const [watchStatus, setWatchStatus] = useState<Record<string, string>>({});

  useEffect(() => {
    logMonetisationClientEvent("ops_webhook_queue_view", null, "ops", { range: since });
    if ((initialItems ?? []).length === 0) {
      logMonetisationClientEvent("ops_webhooks_queue_empty_view", null, "ops", { range: since });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [since]);

  const fetchItems = async (append = false) => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("since", since);
    if (code) params.set("code", code);
    if (q) params.set("q", q);
    if (userId) params.set("userId", userId);
    if (append && cursor) params.set("cursor", cursor);
    logMonetisationClientEvent(append ? "ops_webhook_queue_view" : "ops_webhooks_queue_filter", null, "ops", {
      range: since,
      hasCode: Boolean(code),
      hasQ: Boolean(q),
      chip,
    });
    const res = await fetch(`/api/ops/webhook-failures?${params.toString()}`, { method: "GET", cache: "no-store" });
    const body = await res.json().catch(() => null);
    if (!body?.ok) {
      setLoading(false);
      return;
    }
    if (append) {
      setItems((prev) => [...prev, ...(body.items ?? [])]);
    } else {
      setItems(body.items ?? []);
      if ((body.items ?? []).length === 0) {
        logMonetisationClientEvent("ops_webhooks_queue_empty_view", null, "ops", { range: since });
      }
    }
    setCursor(body.nextCursor ?? null);
    setLoading(false);
  };

  const exportJson = () => {
    logMonetisationClientEvent("ops_webhooks_queue_export", null, "ops", { format: "json", range: since });
    const payload = { note: "No secrets / hashed identifiers", items };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "webhook-failures.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportCsv = () => {
    logMonetisationClientEvent("ops_webhooks_queue_export", null, "ops", { format: "csv", range: since });
    const header = ["requestId", "at", "code", "group", "userId", "eventIdHash"].join(",");
    const rows = items.map((item) =>
      [item.requestId ?? "", item.at, item.code ?? "", item.group ?? "", item.userId ?? "", item.eventIdHash ?? ""]
        .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
        .join(",")
    );
    const blob = new Blob([["# No secrets / hashed identifiers", header, ...rows].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "webhook-failures.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredItems = items.filter((item) => {
    if (chip === "repeating") return item.repeatCount >= 3;
    if (chip === "last24") return new Date(item.at).getTime() >= Date.now() - 24 * 60 * 60 * 1000;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select value={since} onChange={(e) => setSince(e.target.value as SinceFilter)} className="rounded-md border px-2 py-1 text-sm">
          <option value="1h">Last hour</option>
          <option value="24h">Last 24h</option>
          <option value="7d">Last 7d</option>
        </select>
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Code" className="rounded-md border px-2 py-1 text-sm" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search (hashed ok)" className="rounded-md border px-2 py-1 text-sm" />
        <input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="User ID" className="rounded-md border px-2 py-1 text-sm" />
        <button className="rounded-full border border-black/10 bg-white px-3 py-1 text-sm font-semibold" onClick={() => fetchItems(false)} disabled={loading}>
          Apply
        </button>
        <button className="rounded-full border border-black/10 bg-white px-3 py-1 text-sm font-semibold" onClick={exportJson}>
          Export JSON
        </button>
        <button className="rounded-full border border-black/10 bg-white px-3 py-1 text-sm font-semibold" onClick={exportCsv}>
          Export CSV
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${chip === "repeating" ? "border-amber-300 bg-amber-50 text-amber-800" : "border-black/10 bg-white text-[rgb(var(--ink))]"}`}
            onClick={() => {
              const next = chip === "repeating" ? "none" : "repeating";
              setChip(next);
              logMonetisationClientEvent("ops_webhook_chip_click", null, "ops", { chip: "repeating", enabled: next === "repeating" });
            }}
          >
            {"Repeating (>=3)"}
          </button>
          <button
            type="button"
            className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${since === "1h" ? "border-indigo-300 bg-indigo-50 text-indigo-800" : "border-black/10 bg-white text-[rgb(var(--ink))]"}`}
            onClick={() => {
              setSince("1h");
              logMonetisationClientEvent("ops_webhook_chip_click", null, "ops", { chip: "last_hour" });
              fetchItems(false);
            }}
          >
            Last hour
          </button>
          <button
            type="button"
            className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${chip === "last24" ? "border-indigo-300 bg-indigo-50 text-indigo-800" : "border-black/10 bg-white text-[rgb(var(--ink))]"}`}
            onClick={() => {
              const next = chip === "last24" ? "none" : "last24";
              setChip(next);
              if (since !== "7d") {
                setSince("24h");
              }
              logMonetisationClientEvent("ops_webhook_chip_click", null, "ops", { chip: "last24", enabled: next === "last24" });
            }}
          >
            Last 24h
          </button>
        </div>
      </div>
      <div className="rounded-2xl border border-black/10 bg-white p-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-[rgb(var(--ink))]">Webhook failures</p>
          {loading ? <span className="text-xs text-[rgb(var(--muted))]">Loading…</span> : null}
        </div>
        <div className="mt-2 overflow-auto">
          <table className="min-w-full text-left text-xs">
            <thead>
              <tr className="text-[rgb(var(--muted))]">
                <th className="px-2 py-1">Request</th>
                <th className="px-2 py-1">At</th>
                <th className="px-2 py-1">Code</th>
                <th className="px-2 py-1">Group</th>
                <th className="px-2 py-1">User</th>
                <th className="px-2 py-1">Event hash</th>
                <th className="px-2 py-1">Last seen</th>
                <th className="px-2 py-1">Repeats</th>
                <th className="px-2 py-1">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-2 py-3 text-center text-[rgb(var(--muted))]">
                    No webhook failures in range.
                  </td>
                </tr>
              ) : null}
              {filteredItems.map((item) => (
                <tr key={item.id} className="border-t">
                  <td className="px-2 py-1">{item.requestId ?? "—"}</td>
                  <td className="px-2 py-1">{item.at}</td>
                  <td className="px-2 py-1">{item.code ?? "—"}</td>
                  <td className="px-2 py-1">{item.group ?? "—"}</td>
                  <td className="px-2 py-1">{item.userId ?? "—"}</td>
                  <td className="px-2 py-1">{item.eventIdHash ?? "—"}</td>
                  <td className="px-2 py-1">{item.lastSeenAt ?? "—"}</td>
                  <td className="px-2 py-1">{item.repeatCount ?? 1}</td>
                  <td className="px-2 py-1 space-x-2">
                    {item.requestId ? (
                      <Link
                        href={`/app/ops/incidents?requestId=${encodeURIComponent(item.requestId)}&from=ops_webhooks`}
                        className="text-[11px] font-semibold text-[rgb(var(--accent-strong))] underline-offset-2 hover:underline"
                        onClick={() => logMonetisationClientEvent("ops_webhook_open_incidents_click", null, "ops")}
                      >
                        Open incidents
                      </Link>
                    ) : null}
                    {item.userId ? (
                      <Link
                        href={`/app/ops/users/${item.userId}`}
                        className="text-[11px] font-semibold text-[rgb(var(--accent-strong))] underline-offset-2 hover:underline"
                        onClick={() => logMonetisationClientEvent("ops_webhook_open_dossier_click", null, "ops")}
                      >
                        Open dossier
                      </Link>
                    ) : null}
                    <button
                      type="button"
                      className="text-[11px] font-semibold text-[rgb(var(--ink))] underline-offset-2 hover:underline"
                      onClick={() => {
                        const snippet = `Webhook failure | request ${item.requestId ?? "unknown"} | code ${item.code ?? "unknown"} | hash ${
                          item.eventIdHash ?? "n/a"
                        }`;
                        navigator.clipboard.writeText(snippet).catch(() => undefined);
                        logMonetisationClientEvent("ops_webhooks_queue_view", null, "ops", { range: since, action: "copy_snippet" });
                      }}
                    >
                      Copy support snippet
                    </button>
                    <button
                      type="button"
                      className="text-[11px] font-semibold text-[rgb(var(--accent-strong))] underline-offset-2 hover:underline"
                      onClick={async () => {
                        logMonetisationClientEvent("ops_webhook_watch_click", null, "ops", { code: item.code ?? "unknown" });
                        setWatchStatus((prev) => ({ ...prev, [item.id]: "Saving..." }));
                        try {
                          const res = await fetch("/api/ops/watch", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          requestId: item.requestId ?? `webhook_${item.groupKeyHash ?? item.eventIdHash ?? item.id}`,
                          reasonCode: "webhook_failure",
                          note: `code ${item.code ?? "unknown"} | hash ${item.groupKeyHash ?? item.eventIdHash ?? "n/a"}`,
                          ttlHours: 24,
                        }),
                      });
                      const body = await res.json().catch(() => null);
                      if (res.status === 429 || body?.error?.code === "RATE_LIMITED") {
                        const retryAfter = Number(res.headers.get("retry-after") ?? body?.retryAfter ?? 0);
                        const retryAfterSeconds = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null;
                        setWatchStatus((prev) => ({ ...prev, [item.id]: retryAfterSeconds ? `Rate limited — ~${retryAfterSeconds}s` : "Rate limited" }));
                        logMonetisationClientEvent("ops_action_rate_limited", null, "ops", {
                          action: "webhook_watch",
                          retryAfterSeconds,
                        });
                        return;
                      }
                      if (body?.ok) {
                        setWatchStatus((prev) => ({ ...prev, [item.id]: "Watch created" }));
                        logMonetisationClientEvent("ops_webhook_watch_success", null, "ops", { code: item.code ?? "unknown" });
                      } else {
                        setWatchStatus((prev) => ({ ...prev, [item.id]: "Watch failed" }));
                        logMonetisationClientEvent("ops_webhook_watch_error", null, "ops", { code: item.code ?? "unknown" });
                          }
                        } catch {
                          setWatchStatus((prev) => ({ ...prev, [item.id]: "Watch failed" }));
                          logMonetisationClientEvent("ops_webhook_watch_error", null, "ops", { code: item.code ?? "unknown" });
                        }
                      }}
                    >
                      {watchStatus[item.id] ?? "Watch"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {cursor ? (
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-[rgb(var(--ink))] hover:bg-slate-50"
              onClick={() => fetchItems(true)}
              disabled={loading}
            >
              Load more
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
