import { buildCaseRange, type CaseWindow } from "@/lib/ops/ops-case-model";
import { isUuid } from "@/lib/ops/ops-case-parse";
import { normaliseId } from "@/lib/ops/normalise-id";
import {
  normaliseCasePriority,
  normaliseCaseStatus,
  type CasePriority,
  type CaseWorkflowStatus,
} from "@/lib/ops/ops-case-workflow";

export type CaseQueueSort = "lastTouched" | "createdAt" | "priority" | "status";
export type CaseQueueAssignedFilter = "any" | "me" | "unassigned";
export type CaseQueueStatusFilter = "all" | CaseWorkflowStatus;
export type CaseQueuePriorityFilter = "all" | CasePriority;

export type CaseQueueCursor = { ts: string; id: string };

export function normaliseCaseQueueSort(value?: string | null): CaseQueueSort {
  if (value === "createdAt" || value === "priority" || value === "status") return value;
  return "lastTouched";
}

export function normaliseCaseQueueAssigned(value?: string | null): CaseQueueAssignedFilter | null {
  if (!value || value === "any") return "any";
  if (value === "me" || value === "unassigned") return value;
  return null;
}

export function normaliseCaseQueueStatus(value?: string | null): CaseQueueStatusFilter | null {
  if (!value || value === "all") return "all";
  const parsed = normaliseCaseStatus(value);
  return parsed ?? null;
}

export function normaliseCaseQueuePriority(value?: string | null): CaseQueuePriorityFilter | null {
  if (!value || value === "all") return "all";
  const parsed = normaliseCasePriority(value);
  return parsed ?? null;
}

export function normaliseCaseQueueWindow(input?: string | null): CaseWindow {
  if (input === "15m" || input === "24h" || input === "7d") return input;
  return "24h";
}

export function getWindowFromIso(window: CaseWindow, now = new Date()) {
  return buildCaseRange({ window, now });
}

export function normaliseCaseQueueQuery(value?: string | null) {
  const trimmed = normaliseId(value ?? "").slice(0, 64).replace(/[%]/g, "");
  if (!trimmed) return { kind: "none", value: "" } as const;
  if (trimmed.toLowerCase().startsWith("req_")) return { kind: "requestId", value: trimmed } as const;
  if (isUuid(trimmed)) return { kind: "userId", value: trimmed } as const;
  return { kind: "requestId", value: trimmed } as const;
}

export function encodeCaseQueueCursor(cursor: CaseQueueCursor) {
  return Buffer.from(`${cursor.ts}|${cursor.id}`, "utf8").toString("base64");
}

export function decodeCaseQueueCursor(cursor: string | null): CaseQueueCursor | null {
  if (!cursor) return null;
  try {
    const decoded = Buffer.from(cursor, "base64").toString("utf8");
    const [ts, id] = decoded.split("|");
    if (!ts || !id || Number.isNaN(Date.parse(ts))) return null;
    return { ts, id };
  } catch {
    return null;
  }
}

export function resolveCaseLastTouched({
  workflowTouched,
  workflowUpdated,
  notesUpdated,
  evidenceUpdated,
}: {
  workflowTouched?: string | null;
  workflowUpdated?: string | null;
  notesUpdated?: string | null;
  evidenceUpdated?: string | null;
}) {
  const values = [workflowTouched, workflowUpdated, notesUpdated, evidenceUpdated]
    .filter(Boolean)
    .map((value) => new Date(value as string).getTime())
    .filter((value) => !Number.isNaN(value));
  if (!values.length) return new Date().toISOString();
  return new Date(Math.max(...values)).toISOString();
}
