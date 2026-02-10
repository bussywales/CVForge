"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

const GENERATION_STAGES = ["CV", "Cover letter", "STAR / Evidence", "Fit map"] as const;
type GenerationStageKey = (typeof GENERATION_STAGES)[number];

function formatRelativeTime(iso?: string | null, nowMs?: number) {
  if (!iso) return "—";
  const date = new Date(iso);
  const ts = date.getTime();
  if (Number.isNaN(ts)) return "—";
  const now = typeof nowMs === "number" ? nowMs : Date.now();
  const diffMs = Math.max(0, now - ts);
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function hasMeaningfulOutputs(outputs: PackOutputs) {
  if (outputs.cv.summary.trim()) return true;
  if (outputs.cv.sections.some((s) => s.bullets.some((b) => b.trim()))) return true;
  if (outputs.coverLetter.trim()) return true;
  if (outputs.starStories.length > 0) return true;
  if (outputs.fitMap.length > 0) return true;
  if (outputs.rationale.trim()) return true;
  return false;
}

function buildCopyText(tab: OutputTabKey, outputs: PackOutputs) {
  if (tab === "cv") {
    const lines: string[] = [];
    if (outputs.cv.summary.trim()) {
      lines.push("CV Summary");
      lines.push(outputs.cv.summary.trim());
      lines.push("");
    }
    outputs.cv.sections.forEach((section) => {
      lines.push(section.title.trim() || "Section");
      section.bullets.forEach((bullet) => {
        const b = bullet.trim();
        if (b) lines.push(`- ${b}`);
      });
      lines.push("");
    });
    return lines.join("\n").trim();
  }
  if (tab === "cover") {
    const cover = outputs.coverLetter.trim();
    return ["Cover letter", cover || "(empty)"].join("\n\n").trim();
  }
  if (tab === "star") {
    const lines: string[] = ["STAR / Evidence"];
    if (!outputs.starStories.length) {
      lines.push("(empty)");
      return lines.join("\n");
    }
    outputs.starStories.forEach((story, idx) => {
      lines.push("");
      lines.push(`${idx + 1}. ${story.title.trim() || "Story"}`);
      if (story.situation.trim()) lines.push(`Situation: ${story.situation.trim()}`);
      if (story.task.trim()) lines.push(`Task: ${story.task.trim()}`);
      if (story.action.trim()) lines.push(`Action: ${story.action.trim()}`);
      if (story.result.trim()) lines.push(`Result: ${story.result.trim()}`);
      if ((story.relevance ?? "").trim()) lines.push(`Why it fits: ${(story.relevance ?? "").trim()}`);
    });
    return lines.join("\n").trim();
  }
  if (tab === "fit") {
    const lines: string[] = ["Fit map"];
    if (!outputs.fitMap.length) {
      lines.push("(empty)");
      return lines.join("\n");
    }
    outputs.fitMap.forEach((entry, idx) => {
      lines.push("");
      lines.push(`${idx + 1}. ${entry.requirement.trim() || "Requirement"}`);
      lines.push(`Match: ${entry.match.toUpperCase()}`);
      if (entry.evidence.length) {
        lines.push("Evidence:");
        entry.evidence.forEach((ev) => {
          const e = String(ev ?? "").trim();
          if (e) lines.push(`- ${e}`);
        });
      }
      if ((entry.notes ?? "").trim()) lines.push(`Notes: ${(entry.notes ?? "").trim()}`);
    });
    return lines.join("\n").trim();
  }
  const why = outputs.rationale.trim();
  return ["What changed", why || "(empty)"].join("\n\n").trim();
}

function summariseWhatChanged(current: PackOutputs, previous: PackOutputs) {
  const changes: string[] = [];
  if ((current.cv.summary || "").trim() !== (previous.cv.summary || "").trim()) {
    changes.push("CV summary changed.");
  }
  const currCvBullets = current.cv.sections.reduce((acc, s) => acc + s.bullets.filter((b) => b.trim()).length, 0);
  const prevCvBullets = previous.cv.sections.reduce((acc, s) => acc + s.bullets.filter((b) => b.trim()).length, 0);
  if (currCvBullets !== prevCvBullets) {
    changes.push(`CV bullets: ${prevCvBullets} -> ${currCvBullets}.`);
  }
  if ((current.coverLetter || "").trim() !== (previous.coverLetter || "").trim()) {
    changes.push("Cover letter changed.");
  }
  if (current.starStories.length !== previous.starStories.length) {
    changes.push(`STAR stories: ${previous.starStories.length} -> ${current.starStories.length}.`);
  }
  if (current.fitMap.length !== previous.fitMap.length) {
    changes.push(`Fit map items: ${previous.fitMap.length} -> ${current.fitMap.length}.`);
  }
  if (!changes.length) {
    changes.push("No meaningful content changes detected.");
  }
  return changes;
}

export default function PackDetailClient({ initialPack, initialVersions }: PackDetailClientProps) {
  const [pack, setPack] = useState<PackRecord>(initialPack);
  const [versions, setVersions] = useState<PackVersionRecord[]>(initialVersions);
  const [jobDescription, setJobDescription] = useState(initialVersions[0]?.jobDescription ?? "");
  const [cvText, setCvText] = useState("");
  const [notes, setNotes] = useState("");
  const [activeTab, setActiveTab] = useState<OutputTabKey>("cv");
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(initialVersions[0]?.id ?? null);
  const [generateState, setGenerateState] = useState<"idle" | "loading">("idle");
  const [generationStage, setGenerationStage] = useState<GenerationStageKey | null>(null);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<ErrorState>(null);
  const [successHint, setSuccessHint] = useState<string | null>(null);
  const [copyHint, setCopyHint] = useState<string | null>(null);

  const stageTimerRef = useRef<number | null>(null);
  const copyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (stageTimerRef.current) window.clearInterval(stageTimerRef.current);
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
    };
  }, []);

  const versionNumberById = useMemo(() => {
    const sorted = [...versions].sort((a, b) => {
      const at = new Date(a.createdAt).getTime();
      const bt = new Date(b.createdAt).getTime();
      return at - bt;
    });
    const map = new Map<string, number>();
    sorted.forEach((v, idx) => map.set(v.id, idx + 1));
    return map;
  }, [versions]);

  const selectedVersion = useMemo(() => versions.find((v) => v.id === selectedVersionId) ?? versions[0] ?? null, [selectedVersionId, versions]);
  const outputs: PackOutputs = useMemo(() => coercePackOutputs(selectedVersion?.outputs ?? {}), [selectedVersion]);
  const lastSavedAt = selectedVersion?.createdAt ?? pack.updatedAt;
  const selectedVersionNumber = selectedVersion ? versionNumberById.get(selectedVersion.id) ?? null : null;
  const latestVersion = versions[0] ?? null;
  const latestVersionNumber = latestVersion ? versionNumberById.get(latestVersion.id) ?? null : null;
  const canExport = Boolean(selectedVersion) && versions.length > 0 && hasMeaningfulOutputs(outputs);

  const selectedVersionIndex = useMemo(() => {
    if (!selectedVersion) return -1;
    return versions.findIndex((v) => v.id === selectedVersion.id);
  }, [selectedVersion, versions]);

  const previousVersion = useMemo(() => {
    if (!selectedVersion || selectedVersionIndex < 0) return null;
    return versions[selectedVersionIndex + 1] ?? null;
  }, [selectedVersion, selectedVersionIndex, versions]);
  const previousOutputs = useMemo(() => coercePackOutputs(previousVersion?.outputs ?? {}), [previousVersion]);
  const whatChangedBullets = useMemo(() => {
    if (!selectedVersion || !previousVersion) return null;
    return summariseWhatChanged(outputs, previousOutputs);
  }, [outputs, previousOutputs, previousVersion, selectedVersion]);

  const handleGenerate = async () => {
    if (!jobDescription.trim()) {
      setError({ message: "Job description is required." });
      return;
    }
    setGenerateState("loading");
    setGenerationStage(GENERATION_STAGES[0]);
    setError(null);
    setSuccessHint(null);
    setCopyHint(null);
    logMonetisationClientEvent("packs_generate_clicked", null, "packs", { packId: pack.id, jdLength: jobDescription.trim().length });
    if (stageTimerRef.current) {
      window.clearInterval(stageTimerRef.current);
      stageTimerRef.current = null;
    }
    let stageIdx = 0;
    stageTimerRef.current = window.setInterval(() => {
      stageIdx = Math.min(GENERATION_STAGES.length - 1, stageIdx + 1);
      setGenerationStage(GENERATION_STAGES[stageIdx]);
    }, 600);
    const res = await fetchJsonSafe<{ ok: boolean; pack?: PackRecord; version?: PackVersionRecord }>(
      `/api/packs/${pack.id}/generate`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        cache: "no-store",
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
      const nextNumber = (versionNumberById.get(nextVersion.id) ?? (versions.length + 1)) as number;
      setSuccessHint(`Pack generated: v${nextNumber}`);
      logMonetisationClientEvent("packs_generate_success", null, "packs", { packId: pack.id, versionId: nextVersion.id });
    } else {
      setError({ message: res.error?.message ?? "Unable to generate pack", requestId: res.requestId });
      logMonetisationClientEvent("packs_generate_failed", null, "packs", { packId: pack.id, code: res.error?.code ?? "HTTP_ERROR" });
    }
    setGenerateState("idle");
    setGenerationStage(null);
    if (stageTimerRef.current) {
      window.clearInterval(stageTimerRef.current);
      stageTimerRef.current = null;
    }
  };

  const handleVersionChange = (nextId: string) => {
    setSelectedVersionId(nextId);
    setSuccessHint(null);
    logMonetisationClientEvent("packs_version_selected", null, "packs", { packId: pack.id, versionId: nextId });
    const version = versions.find((item) => item.id === nextId);
    if (version?.jobDescription) {
      setJobDescription(version.jobDescription);
    }
  };

  const handleExport = async (variant: "standard" | "ats") => {
    if (!selectedVersion || !canExport) return;
    setExporting(true);
    setError(null);
    logMonetisationClientEvent("packs_export_clicked", null, "packs", { packId: pack.id, versionId: selectedVersion.id, variant });
    const response = await fetch(`/api/packs/${pack.id}/export`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      cache: "no-store",
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

  const handleCopyActiveTab = async () => {
    const text = buildCopyText(activeTab, outputs);
    try {
      await navigator.clipboard.writeText(text);
      setCopyHint("Copied.");
      logMonetisationClientEvent("packs_copy_output_clicked", null, "packs", { packId: pack.id, tab: activeTab });
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => setCopyHint(null), 1200);
    } catch {
      setCopyHint("Unable to copy right now.");
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => setCopyHint(null), 1600);
    }
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

      {error ? <ErrorBanner title="Generation failed" message={error.message} requestId={error.requestId ?? undefined} /> : null}
      {error?.requestId ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-[rgb(var(--muted))]">
          <button
            type="button"
            className="rounded-full border border-black/10 bg-white px-3 py-1 font-semibold text-[rgb(var(--ink))]"
            onClick={() => navigator.clipboard.writeText(String(error.requestId)).catch(() => undefined)}
          >
            Copy requestId
          </button>
          <button
            type="button"
            className="rounded-full border border-black/10 bg-white px-3 py-1 font-semibold text-[rgb(var(--ink))]"
            onClick={handleGenerate}
            disabled={generateState === "loading"}
          >
            Retry
          </button>
        </div>
      ) : null}
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
                        {index === 0 ? `v${versionNumberById.get(version.id) ?? "?"} (latest)` : `v${versionNumberById.get(version.id) ?? "?"}`} · {formatShortLocalTime(version.createdAt)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-[11px] text-[rgb(var(--muted))]">No versions yet</span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="secondary" onClick={() => handleExport("standard")} disabled={!canExport || exporting}>
                  {exporting ? "Exporting…" : "Export DOCX"}
                </Button>
                <Button variant="secondary" onClick={() => handleExport("ats")} disabled={!canExport || exporting}>
                  ATS DOCX
                </Button>
              </div>
            </div>

            {versions.length === 0 ? (
              <p className="mt-2 text-xs text-[rgb(var(--muted))]">Generate a version first.</p>
            ) : !canExport ? (
              <p className="mt-2 text-xs text-[rgb(var(--muted))]">This version has no output to export yet.</p>
            ) : (
              <p className="mt-2 text-xs text-[rgb(var(--muted))]">
                Latest: v{latestVersionNumber ?? "?"} · generated {formatRelativeTime(latestVersion?.createdAt ?? null)}
              </p>
            )}

            {generateState === "loading" ? (
              <div className="mt-3 rounded-2xl border border-black/10 bg-white/60 px-4 py-3 text-xs text-[rgb(var(--muted))]">
                <p className="font-semibold text-[rgb(var(--ink))]">Generating…</p>
                <ul className="mt-2 space-y-1">
                  {GENERATION_STAGES.map((stage) => {
                    const active = generationStage === stage;
                    const done = generationStage ? GENERATION_STAGES.indexOf(stage) < GENERATION_STAGES.indexOf(generationStage) : false;
                    return (
                      <li key={stage}>
                        <span className="font-semibold text-[rgb(var(--ink))]">{done ? "Done" : active ? "Now" : "Next"}</span>
                        <span className="ml-2">{stage}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}

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
              <div className="flex-1" />
              <button
                type="button"
                onClick={handleCopyActiveTab}
                className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-[rgb(var(--ink))]"
              >
                Copy
              </button>
              {copyHint ? <span className="self-center text-[11px] text-[rgb(var(--muted))]">{copyHint}</span> : null}
            </div>

            <div className="mt-4 rounded-2xl border border-black/10 bg-white/70 p-4 text-sm text-[rgb(var(--ink))]">
              {versions.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-black/20 bg-white/70 p-5">
                  <p className="text-sm font-semibold text-[rgb(var(--ink))]">No output yet</p>
                  <p className="mt-1 text-xs text-[rgb(var(--muted))]">Paste a job description and click Generate pack.</p>
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-[rgb(var(--muted))]">
                    <li>Job description required</li>
                    <li>Existing CV optional</li>
                    <li>Notes optional</li>
                  </ul>
                </div>
              ) : null}

              {versions.length > 0 && activeTab === "cv" ? (
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

              {versions.length > 0 && activeTab === "cover" ? (
                <div className="whitespace-pre-line text-sm text-[rgb(var(--ink))]">
                  {outputs.coverLetter || "No cover letter generated yet."}
                </div>
              ) : null}

              {versions.length > 0 && activeTab === "star" ? (
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

              {versions.length > 0 && activeTab === "fit" ? (
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

              {versions.length > 0 && activeTab === "why" ? (
                <div className="space-y-4">
                  {!previousVersion ? (
                    <p className="text-xs text-[rgb(var(--muted))]">No previous version to compare.</p>
                  ) : (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
                        Compared to v{versionNumberById.get(previousVersion.id) ?? "?"}
                      </p>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-[rgb(var(--muted))]">
                        {(whatChangedBullets ?? []).map((item, idx) => (
                          <li key={`${item}-${idx}`}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="whitespace-pre-line text-sm text-[rgb(var(--ink))]">
                    {outputs.rationale || "No rationale yet."}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
