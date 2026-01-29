export type AlertsWebhookConfig = {
  configured: boolean;
  mode: "disabled" | "missing_url" | "missing_secret" | "misconfigured" | "enabled";
  hint: string;
  setupHref: string;
  safeMeta: { hasUrl: boolean; hasSecret: boolean };
};

const SETUP_HREF = "/app/ops/status#alerts";

function isValidHttpUrl(raw: string) {
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function getAlertsWebhookConfig({
  url = process.env.OPS_ALERT_WEBHOOK_URL,
  secret = process.env.OPS_ALERT_WEBHOOK_SECRET,
}: {
  url?: string | null;
  secret?: string | null;
} = {}): AlertsWebhookConfig {
  const trimmedUrl = typeof url === "string" ? url.trim() : "";
  const trimmedSecret = typeof secret === "string" ? secret.trim() : "";
  const hasUrl = trimmedUrl.length > 0;
  const hasSecret = trimmedSecret.length > 0;
  let mode: AlertsWebhookConfig["mode"];

  if (!hasUrl && !hasSecret) {
    mode = "disabled";
  } else if (!hasUrl && hasSecret) {
    mode = "missing_url";
  } else if (hasUrl && !hasSecret) {
    mode = "missing_secret";
  } else if (!isValidHttpUrl(trimmedUrl)) {
    mode = "misconfigured";
  } else {
    mode = "enabled";
  }

  const hint =
    mode === "enabled"
      ? "Webhook notifications enabled."
      : mode === "missing_url"
        ? "Webhook URL missing. Add OPS_ALERT_WEBHOOK_URL."
        : mode === "missing_secret"
          ? "Webhook secret missing. Add OPS_ALERT_WEBHOOK_SECRET."
          : mode === "misconfigured"
            ? "Webhook config looks invalid. Check URL and secret."
            : "Webhook notifications disabled.";

  return {
    configured: mode === "enabled",
    mode,
    hint,
    setupHref: SETUP_HREF,
    safeMeta: { hasUrl, hasSecret },
  };
}
