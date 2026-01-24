export function getWebhookConfig() {
  const url = process.env.OPS_ALERT_WEBHOOK_URL;
  const configured = Boolean(url && url.trim().length > 0);
  return {
    configured,
    mode: configured ? "configured" : "disabled",
    hint: configured ? "Webhook notifications configured." : "Webhook notifications disabled.",
  };
}
