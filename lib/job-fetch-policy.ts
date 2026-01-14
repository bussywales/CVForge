const BLOCKED_HOST_PATTERNS = [
  {
    pattern: /(^|\.)indeed\.com$/i,
    reason: "BLOCKED_SOURCE_INDEED",
    message:
      "Indeed blocks automated fetch. Please open the advert and paste the job text.",
  },
  {
    pattern: /(^|\.)linkedin\.com$/i,
    reason: "BLOCKED_SOURCE_LINKEDIN",
    message:
      "LinkedIn blocks automated fetch. Please open the advert and paste the job text.",
  },
];

export type BlockedJobFetchResult = {
  blocked: boolean;
  reason?: string;
  message?: string;
  suggestedAction?: "open_and_paste";
};

export function isBlockedJobFetchUrl(url: URL): BlockedJobFetchResult {
  const host = url.host.toLowerCase();
  for (const entry of BLOCKED_HOST_PATTERNS) {
    if (entry.pattern.test(host)) {
      return {
        blocked: true,
        reason: entry.reason,
        message: entry.message,
        suggestedAction: "open_and_paste",
      };
    }
  }
  return { blocked: false };
}

export function buildBlockedFetchResponse(params: {
  reason: string;
  message: string;
  urlHost: string;
}) {
  return {
    ok: false,
    blocked: true,
    reason: params.reason,
    message: params.message,
    urlHost: params.urlHost,
    suggestedAction: "open_and_paste" as const,
  };
}
