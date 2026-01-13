"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/Button";
import type { CvImportPreview } from "@/lib/cv-import";

type ImportStatus = "idle" | "loading" | "ready" | "error" | "applying";

function formatRoleDates(
  startDate?: string,
  endDate?: string,
  isCurrent?: boolean
) {
  const startLabel = formatMonthYear(startDate);
  const endLabel = isCurrent
    ? "Present"
    : endDate
      ? formatMonthYear(endDate)
      : "Present";
  if (!startLabel) {
    return endLabel;
  }
  return `${startLabel} – ${endLabel}`;
}

function formatMonthYear(value?: string) {
  if (!value) {
    return "";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    year: "numeric",
  }).format(parsed);
}

export default function CvImportModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<ImportStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<CvImportPreview | null>(null);
  const [applyName, setApplyName] = useState(false);
  const [applyHeadline, setApplyHeadline] = useState(false);
  const [applyAchievements, setApplyAchievements] = useState(false);
  const [selectedAchievements, setSelectedAchievements] = useState<boolean[]>([]);
  const [applyWorkHistory, setApplyWorkHistory] = useState(false);
  const [selectedWorkHistory, setSelectedWorkHistory] = useState<boolean[]>([]);

  const canApply = useMemo(() => {
    if (!preview) {
      return false;
    }
    if (applyName || applyHeadline) {
      return true;
    }
    if (applyAchievements && selectedAchievements.some(Boolean)) {
      return true;
    }
    if (applyWorkHistory && selectedWorkHistory.some(Boolean)) {
      return true;
    }
    return false;
  }, [
    applyAchievements,
    applyHeadline,
    applyName,
    applyWorkHistory,
    preview,
    selectedAchievements,
    selectedWorkHistory,
  ]);

  const handleReset = () => {
    setFile(null);
    setPreview(null);
    setApplyName(false);
    setApplyHeadline(false);
    setApplyAchievements(false);
    setSelectedAchievements([]);
    setApplyWorkHistory(false);
    setSelectedWorkHistory([]);
    setStatus("idle");
    setMessage(null);
  };

  const handlePreview = async () => {
    if (!file) {
      setMessage("Select a DOCX file to continue.");
      setStatus("error");
      return;
    }

    setStatus("loading");
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/import/cv-docx", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage((payload as { error?: string })?.error ?? "Unable to import that file.");
        setStatus("error");
        return;
      }

      const previewPayload = payload as CvImportPreview;
      setPreview(previewPayload);
      setApplyName(Boolean(previewPayload.profile.full_name));
      setApplyHeadline(Boolean(previewPayload.profile.headline));
      setApplyAchievements(previewPayload.achievements.length > 0);
      setSelectedAchievements(previewPayload.achievements.map(() => true));
      setApplyWorkHistory(previewPayload.work_history.length > 0);
      setSelectedWorkHistory(previewPayload.work_history.map(() => true));
      setStatus("ready");
    } catch (error) {
      console.error("[cv.import.preview]", error);
      setMessage("Unable to import that file.");
      setStatus("error");
    }
  };

  const handleApply = async () => {
    if (!preview) {
      return;
    }

    setStatus("applying");
    setMessage(null);

    const selectedIndexes = selectedAchievements
      .map((checked, index) => (checked ? index : -1))
      .filter((index) => index >= 0);
    const selectedWorkHistoryIndexes = selectedWorkHistory
      .map((checked, index) => (checked ? index : -1))
      .filter((index) => index >= 0);

    const profilePayload: CvImportPreview["profile"] = {};
    if (applyName && preview.profile.full_name) {
      profilePayload.full_name = preview.profile.full_name;
    }
    if (applyHeadline && preview.profile.headline) {
      profilePayload.headline = preview.profile.headline;
    }

    try {
      const response = await fetch("/api/import/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          profile: profilePayload,
          achievements: preview.achievements,
          extracted: preview.extracted,
          selections: {
            applyProfile: Boolean(
              profilePayload.full_name || profilePayload.headline
            ),
            applyAchievements,
            selectedAchievementIndexes: selectedIndexes,
            applyWorkHistory,
            selectedWorkHistoryIndexes,
          },
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setMessage(payload?.error ?? "Unable to apply the import.");
        setStatus("error");
        return;
      }

      setMessage("Import applied. Review your profile and work history.");
      setStatus("ready");
      router.refresh();
    } catch (error) {
      console.error("[cv.import.apply]", error);
      setMessage("Unable to apply the import.");
      setStatus("error");
    }
  };

  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        Import CV (DOCX)
      </Button>
      {open ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-[rgb(var(--ink))]">
                  Import CV (DOCX)
                </h3>
                <p className="mt-1 text-sm text-[rgb(var(--muted))]">
                  Upload a DOCX CV to preview extracted profile fields and achievements.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  handleReset();
                }}
                className="rounded-full border border-black/10 px-3 py-1 text-xs font-semibold text-[rgb(var(--muted))] hover:text-[rgb(var(--ink))]"
              >
                Close
              </button>
            </div>

            {message ? (
              <div
                className={`mt-4 rounded-2xl border p-3 text-sm ${
                  status === "error"
                    ? "border-red-200 bg-red-50 text-red-700"
                    : "border-emerald-200 bg-emerald-50 text-emerald-700"
                }`}
              >
                {message}
              </div>
            ) : null}

            <div className="mt-6 space-y-4">
              <div className="rounded-2xl border border-dashed border-black/10 bg-white/70 p-4">
                <label className="text-sm font-medium text-[rgb(var(--ink))]">
                  DOCX file
                </label>
                <input
                  type="file"
                  accept=".docx"
                  onChange={(event) => {
                    const selected = event.target.files?.[0] ?? null;
                    setFile(selected);
                    setPreview(null);
                    setStatus("idle");
                    setMessage(null);
                  }}
                  className="mt-2 block w-full text-sm text-[rgb(var(--muted))]"
                />
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    onClick={handlePreview}
                    disabled={!file || status === "loading"}
                  >
                    {status === "loading" ? "Extracting..." : "Preview import"}
                  </Button>
                  {preview ? (
                    <Button type="button" variant="ghost" onClick={handleReset}>
                      Clear
                    </Button>
                  ) : null}
                </div>
              </div>

              {preview ? (
                <div className="space-y-5">
                  <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
                      Profile fields
                    </p>
                    <div className="mt-3 space-y-2 text-sm">
                      {preview.profile.full_name ? (
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={applyName}
                            onChange={(event) => setApplyName(event.target.checked)}
                          />
                          <span>
                            Full name:{" "}
                            <span className="font-semibold">
                              {preview.profile.full_name}
                            </span>
                          </span>
                        </label>
                      ) : (
                        <p className="text-sm text-[rgb(var(--muted))]">
                          No name detected.
                        </p>
                      )}
                      {preview.profile.headline ? (
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={applyHeadline}
                            onChange={(event) =>
                              setApplyHeadline(event.target.checked)
                            }
                          />
                          <span>
                            Headline:{" "}
                            <span className="font-semibold">
                              {preview.profile.headline}
                            </span>
                          </span>
                        </label>
                      ) : (
                        <p className="text-sm text-[rgb(var(--muted))]">
                          No headline detected.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
                        Achievements
                      </p>
                      <label className="flex items-center gap-2 text-xs text-[rgb(var(--muted))]">
                        <input
                          type="checkbox"
                          checked={applyAchievements}
                          onChange={(event) =>
                            setApplyAchievements(event.target.checked)
                          }
                        />
                        Apply achievements
                      </label>
                    </div>

                    {preview.achievements.length ? (
                      <div className="mt-4 space-y-3">
                        {preview.achievements.map((achievement, index) => (
                          <label
                            key={`${achievement.title}-${index}`}
                            className="flex items-start gap-3 rounded-2xl border border-black/10 bg-white/80 p-3"
                          >
                            <input
                              type="checkbox"
                              disabled={!applyAchievements}
                              checked={selectedAchievements[index] ?? false}
                              onChange={(event) => {
                                const next = [...selectedAchievements];
                                next[index] = event.target.checked;
                                setSelectedAchievements(next);
                              }}
                            />
                            <div className="space-y-1 text-sm">
                              <p className="font-semibold text-[rgb(var(--ink))]">
                                {achievement.title}
                              </p>
                              {achievement.action ? (
                                <p className="text-xs text-[rgb(var(--muted))]">
                                  {achievement.action.length > 140
                                    ? `${achievement.action.slice(0, 140)}...`
                                    : achievement.action}
                                </p>
                              ) : null}
                              {achievement.metrics ? (
                                <p className="text-xs text-[rgb(var(--muted))]">
                                  Metrics: {achievement.metrics}
                                </p>
                              ) : null}
                            </div>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-[rgb(var(--muted))]">
                        No achievements were detected.
                      </p>
                    )}
                  </div>

                  <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
                        Work history detected
                      </p>
                      <label className="flex items-center gap-2 text-xs text-[rgb(var(--muted))]">
                        <input
                          type="checkbox"
                          checked={applyWorkHistory}
                          onChange={(event) =>
                            setApplyWorkHistory(event.target.checked)
                          }
                        />
                        Apply work history
                      </label>
                    </div>

                    {preview.work_history.length ? (
                      <div className="mt-4 space-y-3">
                        {preview.work_history.map((role, index) => (
                          <label
                            key={`${role.job_title}-${role.company}-${index}`}
                            className="flex items-start gap-3 rounded-2xl border border-black/10 bg-white/80 p-3"
                          >
                            <input
                              type="checkbox"
                              disabled={!applyWorkHistory}
                              checked={selectedWorkHistory[index] ?? false}
                              onChange={(event) => {
                                const next = [...selectedWorkHistory];
                                next[index] = event.target.checked;
                                setSelectedWorkHistory(next);
                              }}
                            />
                            <div className="space-y-1 text-sm">
                              <p className="font-semibold text-[rgb(var(--ink))]">
                                {role.job_title} — {role.company}
                              </p>
                              <p className="text-xs text-[rgb(var(--muted))]">
                                {role.location ? `${role.location} · ` : ""}
                                {formatRoleDates(role.start_date, role.end_date, role.is_current)}
                              </p>
                              {role.summary ? (
                                <p className="text-xs text-[rgb(var(--muted))]">
                                  {role.summary}
                                </p>
                              ) : null}
                              {role.bullets?.length ? (
                                <p className="text-xs text-[rgb(var(--muted))]">
                                  {role.bullets.length} highlight{role.bullets.length === 1 ? "" : "s"}
                                </p>
                              ) : null}
                            </div>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-[rgb(var(--muted))]">
                        No work history roles were detected.
                      </p>
                    )}
                  </div>

                  {preview.extracted.sectionsDetected.length ? (
                    <div className="rounded-2xl border border-black/10 bg-white/70 p-4 text-sm">
                      <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted))]">
                        Sections detected
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        {preview.extracted.sectionsDetected.map((section) => (
                          <span
                            key={section}
                            className="rounded-full border border-black/10 bg-white/80 px-3 py-1 font-semibold text-[rgb(var(--ink))]"
                          >
                            {section}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {preview.extracted.warnings.length ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
                      <p className="text-xs uppercase tracking-[0.2em] text-amber-700">
                        Warnings
                      </p>
                      <ul className="mt-2 space-y-1">
                        {preview.extracted.warnings.map((warning) => (
                          <li key={warning}>- {warning}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      type="button"
                      onClick={handleApply}
                      disabled={status === "applying" || !canApply}
                    >
                      {status === "applying" ? "Applying..." : "Apply import"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setOpen(false);
                        handleReset();
                      }}
                    >
                      Close
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
