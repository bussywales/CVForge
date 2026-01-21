import "server-only";

import { createHash } from "crypto";

type MonetisationEvent = {
  type: string;
  occurred_at: string;
  created_at?: string;
  body: string | null;
};

type Receipt = {
  lastWebhookAt: string | null;
  lastWebhookType: string | null;
  lastWebhookRequestId: string | null;
  dedupe: { lastEventIdHash: string | null; dupCount24h: number; distinctCount24h: number };
  errors24h: { webhook_error_count: number; topCodes: { code: string; count: number }[] };
};

function hashValue(input: string) {
  return createHash("sha256").update(input).digest("hex").slice(0, 12);
}

function parseMeta(body: string | null): Record<string, any> {
  if (!body) return {};
  try {
    return JSON.parse(body);
  } catch {
    return {};
  }
}

function toEventName(raw: string) {
  return raw.replace("monetisation.", "");
}

function withinWindow(at: string, now: Date, hours: number) {
  const ts = new Date(at).getTime();
  if (!Number.isFinite(ts)) return false;
  return now.getTime() - ts <= hours * 60 * 60 * 1000;
}

export function buildWebhookReceipt({ events, now = new Date() }: { events: MonetisationEvent[]; now?: Date }): Receipt {
  const webhookEvents = events
    .map((evt) => {
      const meta = parseMeta(evt.body);
      return {
        name: toEventName(evt.type),
        at: evt.occurred_at ?? evt.created_at ?? now.toISOString(),
        meta,
      };
    })
    .filter((evt) => evt.name.includes("webhook"));

  const received = webhookEvents.filter((evt) => evt.name.includes("webhook_received"));
  const errors = webhookEvents.filter((evt) => evt.name.includes("webhook_error"));

  const lastWebhook = received.sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""))[0];
  const lastWebhookRequestId = lastWebhook?.meta?.requestId ?? lastWebhook?.meta?.request_id ?? null;
  const lastWebhookType = lastWebhook?.meta?.type ?? (lastWebhook ? "webhook_received" : null);

  const recentReceived = received.filter((evt) => withinWindow(evt.at, now, 24));
  const seenKeys = new Set<string>();
  let dupCount24h = 0;
  recentReceived.forEach((evt) => {
    const eventId =
      evt.meta?.eventId ??
      evt.meta?.event_id ??
      evt.meta?.webhookId ??
      evt.meta?.webhook_id ??
      evt.meta?.id ??
      evt.meta?.requestId ??
      evt.meta?.request_id ??
      evt.at;
    const key = String(eventId);
    if (seenKeys.has(key)) {
      dupCount24h += 1;
    } else {
      seenKeys.add(key);
    }
  });
  const distinctCount24h = seenKeys.size;
  const lastEventId =
    lastWebhook?.meta?.eventId ??
    lastWebhook?.meta?.event_id ??
    lastWebhook?.meta?.webhookId ??
    lastWebhook?.meta?.webhook_id ??
    lastWebhook?.meta?.requestId ??
    lastWebhook?.meta?.request_id ??
    (lastWebhook ? lastWebhook.at : null);
  const lastEventIdHash = lastEventId ? hashValue(String(lastEventId)) : null;

  const recentErrors = errors.filter((evt) => withinWindow(evt.at, now, 24));
  const webhook_error_count = recentErrors.length;
  const codeCounts = recentErrors.reduce((map, evt) => {
    const code = (evt.meta?.code as string | undefined) ?? "unknown";
    map.set(code, (map.get(code) ?? 0) + 1);
    return map;
  }, new Map<string, number>());
  const topCodes = Array.from(codeCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([code, count]) => ({ code, count }))
    .slice(0, 5);

  return {
    lastWebhookAt: lastWebhook?.at ?? null,
    lastWebhookType,
    lastWebhookRequestId,
    dedupe: { lastEventIdHash, dupCount24h, distinctCount24h },
    errors24h: { webhook_error_count, topCodes },
  };
}

export type WebhookReceipt = ReturnType<typeof buildWebhookReceipt>;
