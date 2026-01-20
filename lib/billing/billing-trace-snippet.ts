import type { BillingTimelineEntry } from "@/lib/billing/billing-timeline";
import type { WebhookHealth } from "@/lib/webhook-health";
import type { CreditDelayResult } from "@/lib/billing/billing-credit-delay";

export function buildBillingTraceSnippet({
  requestId,
  timeline,
  webhook,
  delay,
}: {
  requestId?: string | null;
  timeline: BillingTimelineEntry[];
  webhook: WebhookHealth;
  delay: CreditDelayResult;
}) {
  const lines = ["CVForge billing trace", "Page: /app/billing"];
  if (requestId) lines.push(`Reference: ${requestId}`);
  lines.push(`Webhook: ${webhook.status}${webhook.lagSeconds ? ` · lag ${Math.round(webhook.lagSeconds / 60)}m` : ""}`);
  if (delay.state !== "ok") {
    lines.push(`Delay: ${delay.state} · ${delay.message}`);
  }
  lines.push("Recent events:");
  timeline.slice(0, 5).forEach((item) => {
    const ts = item.at;
    const ref = item.requestId ? ` · ref ${item.requestId}` : "";
    lines.push(`- ${item.kind} @ ${ts}${ref}`);
  });
  return lines.join("\n");
}
