import { buildSupportSnippet } from "@/lib/observability/support-snippet";
import type { IncidentRecord } from "@/lib/ops/incidents-shared";

export type AuditLike = {
  id: string;
  at: string;
  action: string;
  actor?: { id?: string | null; email?: string | null; role?: string | null } | null;
  target?: { userId?: string | null } | null;
  requestId?: string | null;
  meta?: Record<string, any> | null;
};

export type SupportBundle = {
  title: string;
  summary: string;
  requestId?: string | null;
  actor?: string | null;
  target?: string | null;
  meta: Record<string, any>;
  nextAction?: string | null;
  snippet: string;
};

const SAFE_META_KEYS = ["flow", "ref", "requestId", "code", "surface", "from", "plan", "pack", "portal", "note", "anchor", "focus"];

function maskEmail(value: string) {
  const [user, domain] = value.split("@");
  if (!domain) return value;
  if (user.length <= 2) return "***@" + domain;
  return `${user[0]}***${user[user.length - 1]}@${domain}`;
}

function maskValue(value: any): any {
  if (typeof value === "string") {
    if (value.includes("@")) return maskEmail(value);
    if (value.toLowerCase().includes("bearer")) return "[masked_token]";
    if (value.toLowerCase().includes("cookie")) return "[masked_cookie]";
    if (value.match(/\d+\.\d+\.\d+\.\d+/)) {
      const parts = value.split(".");
      parts[parts.length - 1] = "xx";
      return parts.join(".");
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((v) => maskValue(v));
  }
  if (value && typeof value === "object") {
    return Object.keys(value).reduce((acc, key) => {
      acc[key] = maskValue((value as any)[key]);
      return acc;
    }, {} as Record<string, any>);
  }
  return value;
}

function pickMeta(meta: Record<string, any> | null | undefined) {
  const picked: Record<string, any> = {};
  if (!meta) return picked;
  SAFE_META_KEYS.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(meta, key)) {
      picked[key] = maskValue((meta as any)[key]);
    }
  });
  // include up to 3 remaining keys (masked) to aid debugging
  const extras = Object.keys(meta).filter((k) => !SAFE_META_KEYS.includes(k)).slice(0, 3);
  extras.forEach((k) => {
    picked[k] = maskValue((meta as any)[k]);
  });
  return picked;
}

function buildTitle(action: string, surface?: string | null, code?: string | null) {
  const parts = [surface ?? action, code].filter(Boolean);
  return parts.length ? parts.join(" • ") : action;
}

export function buildSupportBundleFromAudit(audit: AuditLike): SupportBundle {
  const meta = pickMeta(audit.meta ?? {});
  const actorMasked = audit.actor?.email ? maskEmail(audit.actor.email) : audit.actor?.id ?? null;
  const targetMasked = audit.target?.userId ?? null;
  const title = buildTitle(audit.action, (audit.meta as any)?.surface ?? null, (audit.meta as any)?.code ?? null);
  const requestId = audit.requestId ?? "unknown";
  const summary = `${audit.action} on ${new Date(audit.at).toLocaleString()}${audit.requestId ? ` (ref ${audit.requestId})` : ""}`;
  const snippet = buildSupportSnippet({
    action: audit.action,
    requestId,
    path: (audit.meta as any)?.path ?? "",
    code: (audit.meta as any)?.code ?? undefined,
  });
  const nextAction =
    (audit.meta?.surface ?? audit.action ?? "").toString().toLowerCase().includes("bill")
      ? "Open billing support tools"
      : "Open dossier and recent incidents";
  return {
    title,
    summary,
    requestId,
    actor: actorMasked,
    target: targetMasked,
    meta,
    nextAction,
    snippet,
  };
}

export function buildSupportBundleFromIncident(incident: IncidentRecord): SupportBundle {
  const meta = pickMeta(incident.context as Record<string, any>);
  const actorMasked = incident.emailMasked ?? null;
  const targetMasked = incident.userId ?? null;
  const title = buildTitle(incident.surface, incident.surface, incident.code ?? undefined);
  const summary = `${incident.surface} • ${incident.code ?? "no-code"} · ${incident.message ?? "No message"}`;
  const snippet = buildSupportSnippet({
    action: incident.surface,
    requestId: incident.requestId,
    path: incident.path ?? incident.returnTo ?? "",
    code: incident.code ?? undefined,
  });
  const nextAction = incident.surface === "billing" || incident.surface === "portal" || incident.surface === "checkout" ? "Open billing page or support link generator" : "Open dossier and related audits";
  return {
    title,
    summary,
    requestId: incident.requestId,
    actor: actorMasked,
    target: targetMasked,
    meta,
    nextAction,
    snippet,
  };
}
