import { createServiceRoleClient } from "@/lib/supabase/service";
import { sanitizeMonetisationMeta } from "@/lib/monetisation-guardrails";

export type CaseType = "request" | "user";
export type CaseStatus = "open" | "closed";
export type CaseOutcomeCode = "resolved" | "escalated" | "needs_more_info" | "false_alarm" | "training_only";

export const CASE_OUTCOME_CODES: CaseOutcomeCode[] = [
  "resolved",
  "escalated",
  "needs_more_info",
  "false_alarm",
  "training_only",
];

export const CASE_CHECKLIST_ITEMS = [
  { key: "open_alerts", label: "Open Alerts" },
  { key: "ack_alert", label: "ACK (if applicable)" },
  { key: "open_incidents", label: "Open Incidents" },
  { key: "open_audits", label: "Open Audits" },
  { key: "open_webhooks", label: "Open Webhooks" },
  { key: "billing_checked", label: "Billing checked" },
  { key: "outcome_recorded", label: "Outcome recorded" },
] as const;

export type CaseChecklistKey = (typeof CASE_CHECKLIST_ITEMS)[number]["key"];

export type CaseChecklistEntry = {
  done: boolean;
  at: string | null;
  by: string | null;
};

export type CaseChecklist = Record<string, CaseChecklistEntry>;

export type OpsCaseNotesRow = {
  case_type: CaseType;
  case_key: string;
  window_label: string | null;
  checklist: CaseChecklist;
  outcome_code: CaseOutcomeCode | null;
  notes: string | null;
  status: CaseStatus;
  last_handled_at: string | null;
  last_handled_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CaseNotesPatch = {
  checklist?: Record<string, boolean> | null;
  outcome_code?: CaseOutcomeCode | null;
  notes?: string | null;
  status?: CaseStatus | null;
};

const NOTES_MAX_LEN = 800;

const CASE_CHECKLIST_KEYS = new Set<string>(CASE_CHECKLIST_ITEMS.map((item) => item.key));

export function normaliseCaseType(value?: string | null): CaseType | null {
  if (value === "request" || value === "user") return value;
  return null;
}

export function parseOutcomeCode(value?: unknown): CaseOutcomeCode | null {
  if (typeof value !== "string") return null;
  return CASE_OUTCOME_CODES.includes(value as CaseOutcomeCode) ? (value as CaseOutcomeCode) : null;
}

export function sanitizeCaseNotesText(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim().slice(0, NOTES_MAX_LEN);
  if (!trimmed) return null;
  const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
  const urlPattern = /https?:\/\/\S+/gi;
  return trimmed.replace(emailPattern, "[email-redacted]").replace(urlPattern, "[url-redacted]");
}

function coerceChecklist(input?: Record<string, any> | null): CaseChecklist {
  const next: CaseChecklist = {};
  if (!input) return next;
  Object.entries(input).forEach(([key, value]) => {
    if (!CASE_CHECKLIST_KEYS.has(key)) return;
    const entry = value as CaseChecklistEntry;
    const done = Boolean(entry?.done);
    next[key] = {
      done,
      at: typeof entry?.at === "string" ? entry.at : null,
      by: typeof entry?.by === "string" ? entry.by : null,
    };
  });
  return next;
}

export function mergeChecklistPatch({
  existing,
  patch,
  actorId,
  now,
}: {
  existing: CaseChecklist;
  patch?: Record<string, boolean> | null;
  actorId: string;
  now: Date;
}) {
  const next = { ...existing };
  const toggledKeys: string[] = [];
  if (!patch) return { next, toggledKeys };
  const nowIso = now.toISOString();
  Object.entries(patch).forEach(([key, value]) => {
    if (!CASE_CHECKLIST_KEYS.has(key)) return;
    if (typeof value !== "boolean") return;
    const prev = existing[key];
    const prevDone = Boolean(prev?.done);
    if (prevDone === value) return;
    toggledKeys.push(key);
    next[key] = value
      ? { done: true, at: nowIso, by: actorId }
      : { done: false, at: null, by: null };
  });
  return { next, toggledKeys };
}

export function applyCaseNotesPatch({
  existing,
  patch,
  actorId,
  now,
}: {
  existing: OpsCaseNotesRow | null;
  patch: CaseNotesPatch;
  actorId: string;
  now: Date;
}) {
  const baseChecklist = coerceChecklist(existing?.checklist ?? {});
  const { next: nextChecklist, toggledKeys } = mergeChecklistPatch({
    existing: baseChecklist,
    patch: patch.checklist ?? null,
    actorId,
    now,
  });

  const nextOutcome =
    patch.outcome_code !== undefined ? (patch.outcome_code ?? null) : (existing?.outcome_code ?? null);
  const nextNotes =
    patch.notes !== undefined ? sanitizeCaseNotesText(patch.notes ?? null) : (existing?.notes ?? null);
  const nextStatus = patch.status ?? existing?.status ?? "open";

  if (patch.outcome_code !== undefined && nextOutcome) {
    if (!nextChecklist.outcome_recorded?.done) {
      nextChecklist.outcome_recorded = { done: true, at: now.toISOString(), by: actorId };
      if (!toggledKeys.includes("outcome_recorded")) toggledKeys.push("outcome_recorded");
    }
  }

  const outcomeChanged = nextOutcome !== (existing?.outcome_code ?? null);
  const notesChanged = nextNotes !== (existing?.notes ?? null);
  const statusChanged = nextStatus !== (existing?.status ?? "open");
  const checklistChanged = toggledKeys.length > 0;
  const changed = outcomeChanged || notesChanged || statusChanged || checklistChanged;

  return {
    nextChecklist,
    nextOutcome,
    nextNotes,
    nextStatus,
    toggledKeys,
    changed,
  };
}

export async function getCaseNotes({
  caseType,
  caseKey,
}: {
  caseType: CaseType;
  caseKey: string;
}): Promise<OpsCaseNotesRow | null> {
  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from("ops_case_notes")
    .select(
      "case_type,case_key,window_label,checklist,outcome_code,notes,status,last_handled_at,last_handled_by,created_at,updated_at"
    )
    .eq("case_type", caseType)
    .eq("case_key", caseKey)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    case_type: data.case_type,
    case_key: data.case_key,
    window_label: data.window_label ?? null,
    checklist: coerceChecklist(data.checklist ?? {}),
    outcome_code: data.outcome_code ?? null,
    notes: data.notes ?? null,
    status: data.status ?? "open",
    last_handled_at: data.last_handled_at ?? null,
    last_handled_by: data.last_handled_by ?? null,
    created_at: data.created_at ?? new Date().toISOString(),
    updated_at: data.updated_at ?? new Date().toISOString(),
  };
}

export async function upsertCaseNotes({
  caseType,
  caseKey,
  patch,
  actorId,
  windowLabel,
  now = new Date(),
}: {
  caseType: CaseType;
  caseKey: string;
  patch: CaseNotesPatch;
  actorId: string;
  windowLabel?: string | null;
  now?: Date;
}): Promise<{ row: OpsCaseNotesRow | null; toggledKeys: string[]; changed: boolean }> {
  const admin = createServiceRoleClient();
  const existing = await getCaseNotes({ caseType, caseKey });
  const { nextChecklist, nextOutcome, nextNotes, nextStatus, toggledKeys, changed } = applyCaseNotesPatch({
    existing,
    patch,
    actorId,
    now,
  });

  if (!existing && !changed) {
    return { row: null, toggledKeys, changed: false };
  }
  if (existing && !changed) {
    return { row: existing, toggledKeys, changed: false };
  }

  const nowIso = now.toISOString();
  const lastHandledAt = changed ? nowIso : existing?.last_handled_at ?? null;
  const lastHandledBy = changed ? actorId : existing?.last_handled_by ?? null;

  const payload = {
    case_type: caseType,
    case_key: caseKey,
    window_label: windowLabel ?? existing?.window_label ?? null,
    checklist: nextChecklist,
    outcome_code: nextOutcome,
    notes: nextNotes,
    status: nextStatus,
    last_handled_at: lastHandledAt,
    last_handled_by: lastHandledBy,
    created_at: existing?.created_at ?? nowIso,
    updated_at: nowIso,
  };

  const { data, error } = await admin
    .from("ops_case_notes")
    .upsert(payload, { onConflict: "case_type,case_key" })
    .select(
      "case_type,case_key,window_label,checklist,outcome_code,notes,status,last_handled_at,last_handled_by,created_at,updated_at"
    )
    .single();
  if (error) throw error;
  const row = {
    case_type: data.case_type,
    case_key: data.case_key,
    window_label: data.window_label ?? null,
    checklist: coerceChecklist(data.checklist ?? {}),
    outcome_code: data.outcome_code ?? null,
    notes: data.notes ?? null,
    status: data.status ?? "open",
    last_handled_at: data.last_handled_at ?? null,
    last_handled_by: data.last_handled_by ?? null,
    created_at: data.created_at ?? nowIso,
    updated_at: data.updated_at ?? nowIso,
  } as OpsCaseNotesRow;
  return { row, toggledKeys, changed: true };
}

export function sanitizeCaseNotesMeta(meta?: Record<string, any>) {
  return sanitizeMonetisationMeta(meta ?? {});
}
