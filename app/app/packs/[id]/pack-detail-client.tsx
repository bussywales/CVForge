"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Button from "@/components/Button";
import FormField from "@/components/FormField";
import ErrorBanner from "@/components/ErrorBanner";
import { fetchJsonSafe, safeReadJson } from "@/lib/http/safe-json";
import { logMonetisationClientEvent } from "@/lib/monetisation-client";
import { formatShortLocalTime } from "@/lib/time/format-short";
import { coercePackOutputs, type PackOutputs, type PackRecord, type PackVersionRecord } from "@/lib/packs/packs-model";

type PackDetailClientProps = {
  initialPack: PackRecord;
  initialVersions: PackVersionRecord[];
};

type ErrorState = { message: string; requestId?: string | null } | null;

const OUTPUT_TABS = [
  { key: "cv", label: "CV" },
  { key: "cover", label: "Cover letter" },
  { key: "star", label: "STAR / Evidence" },
  { key: "fit", label: "Fit map" },
  { key: "why", label: "What changed" },
] as const;

type OutputTabKey = (typeof OUTPUT_TABS)[number]["key"];

export default function PackDetailClient({ initialPack, initialVersions }: PackDetailClientProps) {
  const [pack, setPack] = useState<PackRecord>(initialPack);
  const [versions, setVersions] = useState<PackVersionRecord[]>(initialVersions);
  const [jobDescription, setJobDescription] = useState(initialVersions[0]?.jobDescription ?? "");
  const [cvText, setCvText] = useState("");
  const [notes, setNotes] = useState("");
  const [activeTab, setActiveTab] = useState<OutputTabKey>("cv");
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(initialVersions[0]?.id ?? null);
  const [generateState, setGenerateState] = useState<"idle" | "loading">("idle");
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<ErrorState>(null);
  const [successHint, setSuccessHint] = useState<string | null>(null);

  const selectedVersion = useMemo(() => versions.find((v) => v.id === selectedVersionId) ?? versions[0] ?? null, [selectedVersionId, versions]);
  const outputs: PackOutputs = useMemo(() => coercePackOutputs(selectedVersion?.outputs ?? {}), [selectedVersion]);
  const lastSavedAt = selectedVersion?.createdAt ?? pack.updatedAt;

  const handleGenerate = async () => {
    if (!jobDescription.trim()) {
      setError({ message: "Job description is required." });
      return;
    }
    setGenerateState("loading");
    setError(null);
    setSuccessHint(null);
    const res = await fetchJsonSafe<{ ok: boolean; pack?: PackRecord; version?: PackVersionRecord }>(
      `/api/packs/${pack.id}/generate`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jobDescription,
          cvText: cvText.trim() || null,
          notes: notes.trim() || null,
          mode: "standard",
        }),
      }
    );
    if (res.ok && res.json?.ok && res.json.version) {
      const nextVersion = res.json.version;
      setVersions((prev) => [nextVersion, ...prev]);
      setSelectedVersionId(nextVersion.id);
      setPack((prev) => ({ ...prev, status: res.json?.pack?.status ?? prev.status }));
      setSuccessHint("Pack updated and saved.");
      logMonetisationClientEvent("pack_generated", null, "packs", { packId: pack.id });
    } else {
      setError({ message: res.error?.message ?? "Unable to generate pack", requestId: res.requestId });
      logMonetisationClientEvent("pack_generation_failed", null, "packs", { packId: pack.id });
    }
    setGenerateState("idle");
  };

  const handleVersionChange = (nextId: string) => {
    setSelectedVersionId(nextId);
    setSuccessHint(null);
    logMonetisationClientEvent("pack_version_selected", null, "packs", { packId: pack.id });
    const version = versions.find((item) => item.id === nextId);
    if (version?.jobDescription) {
      setJobDescription(version.jobDescription);
    }
  };

  const handleExport = async (variant: "standard" | "ats") => {
    if (!selectedVersion) return;
    setExporting(true);
    setError(null);
    logMonetisationClientEvent("pack_export_clicked", null, "packs", { packId: pack.id, variant });
    const response = await fetch(`/api/packs/${pack.id}/export`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ versionId: selectedVersion.id, format: "docx", variant }),
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
    setExporting(false);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-black/10 bg-white/80 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">Application Pack</p>
            <h1 className="mt-1 text-2xl font-semibold text-[rgb(var(--ink))]">{pack.title}</h1>
            <p className="mt-1 text-sm text-[rgb(var(--muted))]">
              {pack.company ? `${pack.company} · ` : ""}{pack.roleTitle ?? "Role"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-[rgb(var(--muted))]">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-semibold text-slate-700">
              {pack.status.replace(/_/g, " ")}
            </span>
            <span>Last saved {formatShortLocalTime(lastSavedAt)}</span>
            <Link href="/app/packs" className="text-[rgb(var(--ink))] underline">
              Back to packs
            </Link>
          </div>
        </div>
      </div>

      {error ? <ErrorBanner title="Pack update failed" message={error.message} requestId={error.requestId ?? undefined} /> : null}
      {successHint ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">{successHint}</div> : null}

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1.4fr]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-black/10 bg-white/80 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">Inputs</p>
            <div className="mt-4 space-y-4">
              <FormField label="Job description" htmlFor="pack_job_description">
                <textarea
                  id="pack_job_description"
                  rows={10}
                  value={jobDescription}
                  onChange={(event) => setJobDescription(event.target.value)}
                  className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm"
                />
              </FormField>
              <FormField label="Existing CV text (optional)" htmlFor="pack_cv_text">
                <textarea
                  id="pack_cv_text"
                  rows={6}
                  value={cvText}
                  onChange={(event) => setCvText(event.target.value)}
                  className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm"
                />
              </FormField>
              <FormField label="Notes (optional)" htmlFor="pack_notes">
                <textarea
                  id="pack_notes"
                  rows={4}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm"
                />
              </FormField>
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={handleGenerate} disabled={generateState === "loading"}>
                  {generateState === "loading" ? "Generating…" : "Generate pack"}
                </Button>
                <p className="text-xs text-[rgb(var(--muted))]">Outputs update instantly after generation.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-black/10 bg-white/80 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">Outputs</p>
                {versions.length > 0 ? (
                  <select
                    value={selectedVersion?.id ?? ""}
                    onChange={(event) => handleVersionChange(event.target.value)}
                    className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs"
                  >
                    {versions.map((version, index) => (
                      <option key={version.id} value={version.id}>
                        {index === 0 ? "Latest" : "Version"} · {formatShortLocalTime(version.createdAt)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-[11px] text-[rgb(var(--muted))]">No versions yet</span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="secondary" onClick={() => handleExport("standard")} disabled={!selectedVersion || exporting}>
                  {exporting ? "Exporting…" : "Export DOCX"}
                </Button>
                <Button variant="secondary" onClick={() => handleExport("ats")} disabled={!selectedVersion || exporting}>
                  ATS DOCX
                </Button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {OUTPUT_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    activeTab === tab.key ? "bg-[rgb(var(--accent))] text-white" : "border border-black/10 bg-white text-[rgb(var(--ink))]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="mt-4 rounded-2xl border border-black/10 bg-white/70 p-4 text-sm text-[rgb(var(--ink))]">
              {activeTab === "cv" ? (
                <div className="space-y-4">
                  <p className="text-[rgb(var(--muted))]">{outputs.cv.summary || "No CV summary yet."}</p>
                  {outputs.cv.sections.length ? (
                    <div className="space-y-3">
                      {outputs.cv.sections.map((section, idx) => (
                        <div key={`${section.title}-${idx}`}>
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[rgb(var(--muted))]">{section.title}</p>
                          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[rgb(var(--ink))]">
                            {section.bullets.map((bullet, bulletIdx) => (
                              <li key={`${section.title}-${bulletIdx}`}>{bullet}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-[rgb(var(--muted))]">No CV sections yet.</p>
                  )}
                </div>
              ) : null}

              {activeTab === "cover" ? (
                <div className="whitespace-pre-line text-sm text-[rgb(var(--ink))]">
                  {outputs.coverLetter || "No cover letter generated yet."}
                </div>
              ) : null}

              {activeTab === "star" ? (
                <div className="space-y-3">
                  {outputs.starStories.length ? (
                    outputs.starStories.map((story, idx) => (
                      <div key={`${story.title}-${idx}`} className="rounded-2xl border border-black/10 bg-white/80 p-3">
                        <p className="text-sm font-semibold text-[rgb(var(--ink))]">{story.title}</p>
                        <p className="mt-1 text-xs text-[rgb(var(--muted))]">Situation: {story.situation}</p>
                        <p className="mt-1 text-xs text-[rgb(var(--muted))]">Task: {story.task}</p>
                        <p className="mt-1 text-xs text-[rgb(var(--muted))]">Action: {story.action}</p>
                        <p className="mt-1 text-xs text-[rgb(var(--muted))]">Result: {story.result}</p>
                        {story.relevance ? <p className="mt-2 text-xs text-[rgb(var(--muted))]">Why it fits: {story.relevance}</p> : null}
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-[rgb(var(--muted))]">No STAR suggestions yet.</p>
                  )}
                </div>
              ) : null}

              {activeTab === "fit" ? (
                <div className="space-y-3">
                  {outputs.fitMap.length ? (
                    outputs.fitMap.map((entry, idx) => (
                      <div key={`${entry.requirement}-${idx}`} className="rounded-2xl border border-black/10 bg-white/80 p-3">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="rounded-full border border-black/10 bg-white px-2 py-0.5 text-[11px] font-semibold text-[rgb(var(--ink))]">
                            {entry.match.toUpperCase()}
                          </span>
                          <p className="text-sm font-semibold text-[rgb(var(--ink))]">{entry.requirement}</p>
                        </div>
                        {entry.evidence.length ? (
                          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-[rgb(var(--muted))]">
                            {entry.evidence.map((item, evidenceIdx) => (
                              <li key={`${entry.requirement}-${evidenceIdx}`}>{item}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-2 text-xs text-[rgb(var(--muted))]">No evidence mapped yet.</p>
                        )}
                        {entry.notes ? <p className="mt-2 text-xs text-[rgb(var(--muted))]">{entry.notes}</p> : null}
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-[rgb(var(--muted))]">No fit map entries yet.</p>
                  )}
                </div>
              ) : null}

              {activeTab === "why" ? (
                <div className="whitespace-pre-line text-sm text-[rgb(var(--ink))]">
                  {outputs.rationale || "No rationale yet."}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
