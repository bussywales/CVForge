"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Button from "@/components/Button";
import FormField from "@/components/FormField";
import ErrorBanner from "@/components/ErrorBanner";
import { fetchJsonSafe, safeReadJson } from "@/lib/http/safe-json";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";
import { formatShortLocalTime } from "@/lib/time/format-short";
import type { PackRecord } from "@/lib/packs/packs-model";

type PacksClientProps = {
  initialPacks: PackRecord[];
};

type ErrorState = { message: string; requestId?: string | null } | null;

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  in_progress: "bg-amber-100 text-amber-700",
  ready: "bg-emerald-100 text-emerald-700",
  exported: "bg-blue-100 text-blue-700",
  applied: "bg-indigo-100 text-indigo-700",
  archived: "bg-slate-200 text-slate-700",
};

export default function PacksClient({ initialPacks }: PacksClientProps) {
  const [packs, setPacks] = useState<PackRecord[]>(initialPacks);
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<ErrorState>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);

  const canCreate = title.trim().length > 2;
  const activePacks = useMemo(() => packs.filter((pack) => pack.status !== "archived"), [packs]);

  const handleCreate = async () => {
    if (!canCreate) return;
    setCreating(true);
    setError(null);
    const res = await fetchJsonSafe<{ ok: boolean; pack?: PackRecord }>(`/api/packs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        company: company.trim() || null,
        roleTitle: roleTitle.trim() || null,
        source: "manual",
      }),
    });
    if (res.ok && res.json && res.json.ok && res.json.pack) {
      const createdPack = res.json.pack;
      setPacks((prev) => [createdPack, ...prev]);
      logMonetisationClientEvent("pack_created", null, "packs", { titleLength: title.trim().length });
      setTitle("");
      setCompany("");
      setRoleTitle("");
    } else {
      setError({ message: res.error?.message ?? "Unable to create pack", requestId: res.requestId });
    }
    setCreating(false);
  };

  const handleArchive = async (packId: string) => {
    setArchivingId(packId);
    setError(null);
    const res = await fetchJsonSafe<{ ok: boolean; pack?: PackRecord }>(`/api/packs/${packId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "archived" }),
    });
    if (res.ok && res.json && res.json.ok && res.json.pack) {
      const updatedPack = res.json.pack;
      setPacks((prev) => prev.map((pack) => (pack.id === packId ? updatedPack : pack)));
    } else {
      setError({ message: res.error?.message ?? "Unable to archive pack", requestId: res.requestId });
    }
    setArchivingId(null);
  };

  const handleExport = async (pack: PackRecord, variant: "standard" | "ats") => {
    if (!pack.latestVersionId) return;
    setExportingId(pack.id);
    setError(null);
    logMonetisationClientEvent("pack_export_clicked", null, "packs", { variant, hasVersion: true });
    const response = await fetch(`/api/packs/${pack.id}/export`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ versionId: pack.latestVersionId, format: "docx", variant }),
    });
    if (response.ok) {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "";
      anchor.click();
      window.URL.revokeObjectURL(url);
    } else {
      const parsed = await safeReadJson<{ error?: { message?: string; requestId?: string } }>(response);
      setError({
        message: parsed.json?.error?.message ?? "Export failed",
        requestId: parsed.json?.error?.requestId ?? response.headers.get("x-request-id"),
      });
    }
    setExportingId(null);
  };

  return (
    <div className="space-y-6">
      {error ? <ErrorBanner title="Pack update failed" message={error.message} requestId={error.requestId ?? undefined} /> : null}

      <div className="rounded-2xl border border-dashed border-black/10 bg-white/70 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[rgb(var(--ink))]">Create a new pack</p>
            <p className="text-xs text-[rgb(var(--muted))]">Start from a job description and optional CV notes.</p>
          </div>
          <Button onClick={handleCreate} disabled={!canCreate || creating}>
            {creating ? "Creating…" : "Create pack"}
          </Button>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <FormField label="Pack title" htmlFor="pack_title" hint="e.g., Backend Engineer — Acme">
            <input
              id="pack_title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm"
            />
          </FormField>
          <FormField label="Company (optional)" htmlFor="pack_company">
            <input
              id="pack_company"
              value={company}
              onChange={(event) => setCompany(event.target.value)}
              className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm"
            />
          </FormField>
          <FormField label="Role title (optional)" htmlFor="pack_role">
            <input
              id="pack_role"
              value={roleTitle}
              onChange={(event) => setRoleTitle(event.target.value)}
              className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm"
            />
          </FormField>
        </div>
      </div>

      {activePacks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/20 bg-white/70 p-6 text-sm text-[rgb(var(--muted))]">
          No packs yet. Create one to generate tailored CV and cover letter content.
        </div>
      ) : (
        <div className="space-y-3">
          {activePacks.map((pack) => {
            const statusLabel = pack.status.replace(/_/g, " ");
            const canExport = Boolean(pack.latestVersionId) && ["ready", "exported"].includes(pack.status);
            const lastSaved = pack.latestVersionCreatedAt ?? pack.updatedAt;
            return (
              <div key={pack.id} className="rounded-2xl border border-black/10 bg-white/80 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[rgb(var(--ink))]">{pack.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[rgb(var(--muted))]">
                      {pack.company ? <span>{pack.company}</span> : null}
                      {pack.roleTitle ? <span>{pack.roleTitle}</span> : null}
                      <span className={`rounded-full px-3 py-1 text-[10px] font-semibold ${STATUS_STYLES[pack.status] ?? "bg-slate-100 text-slate-600"}`}>
                        {statusLabel}
                      </span>
                      <span>Last saved {formatShortLocalTime(lastSaved)}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Link
                      href={`/app/packs/${pack.id}`}
                      className="rounded-full border border-black/10 bg-white px-3 py-1 font-semibold text-[rgb(var(--ink))]"
                    >
                      Open
                    </Link>
                    <Button
                      variant="secondary"
                      onClick={() => handleExport(pack, "standard")}
                      disabled={!canExport || exportingId === pack.id}
                    >
                      {exportingId === pack.id ? "Exporting…" : "Export DOCX"}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => handleExport(pack, "ats")}
                      disabled={!canExport || exportingId === pack.id}
                    >
                      ATS DOCX
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => handleArchive(pack.id)}
                      disabled={archivingId === pack.id}
                    >
                      {archivingId === pack.id ? "Archiving…" : "Archive"}
                    </Button>
                  </div>
                </div>
                {!canExport ? (
                  <p className="mt-2 text-xs text-[rgb(var(--muted))]">Generate a version before exporting.</p>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
