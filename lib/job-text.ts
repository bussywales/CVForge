import type { ApplicationRecord } from "@/lib/data/applications";

export type JobTextMeta = {
  source: "fetched" | "pasted";
  status: "ok" | "failed" | "not_fetched";
  fetchedAt: string | null;
  chars: number;
  error: string | null;
  sourceUrl: string | null;
};

export function getEffectiveJobText(application: ApplicationRecord) {
  const fetchedText = application.job_text?.trim() ?? "";
  const manualText = application.job_description?.trim() ?? "";

  if (
    application.job_text_source === "fetched" &&
    fetchedText.length >= 800
  ) {
    return fetchedText;
  }

  if (manualText) {
    return manualText;
  }

  return fetchedText;
}

export function getJobTextMeta(application: ApplicationRecord): JobTextMeta {
  const fetchedText = application.job_text?.trim() ?? "";
  const manualText = application.job_description?.trim() ?? "";
  const fetchedAvailable =
    application.job_text_source === "fetched" && fetchedText.length > 0;
  const source: JobTextMeta["source"] = fetchedAvailable ? "fetched" : "pasted";
  const chars = fetchedAvailable ? fetchedText.length : manualText.length;
  const status = application.job_fetch_status
    ? (application.job_fetch_status as JobTextMeta["status"])
    : fetchedAvailable
      ? "ok"
      : "not_fetched";

  return {
    source,
    status,
    fetchedAt: application.job_fetched_at ?? null,
    chars,
    error: application.job_fetch_error ?? null,
    sourceUrl: application.job_source_url ?? null,
  };
}
