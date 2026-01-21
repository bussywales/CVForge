import { sanitizeMonetisationMeta } from "@/lib/monetisation-guardrails";
import type { ResolutionOutcome, ResolutionOutcomeCode, EffectivenessState } from "@/lib/ops/ops-resolution-outcomes";

export const REVIEW_MIN_AGE_MS = 2 * 60 * 60 * 1000;
export const LATER_WINDOW_MS = 24 * 60 * 60 * 1000;

export type EffectivenessInsights = {
  topFailedCodes: { code: ResolutionOutcomeCode; count: number }[];
  topFailReasons: { reason: string; count: number }[];
  repeatFailedRequestIds: { requestId: string; count: number }[];
};

function sanitizeEffectivenessFields(outcome: ResolutionOutcome) {
  const cleaned = sanitizeMonetisationMeta({
    effectivenessReason: outcome.effectivenessReason ?? null,
    effectivenessNote: outcome.effectivenessNote ?? null,
    effectivenessSource: outcome.effectivenessSource ?? null,
  });
  return {
    reason: typeof cleaned.effectivenessReason === "string" ? cleaned.effectivenessReason : outcome.effectivenessReason ?? null,
    note: typeof cleaned.effectivenessNote === "string" ? cleaned.effectivenessNote : outcome.effectivenessNote ?? null,
    source: typeof cleaned.effectivenessSource === "string" ? cleaned.effectivenessSource : outcome.effectivenessSource ?? null,
  };
}

export function isOutcomeDue(outcome: ResolutionOutcome, now = new Date()) {
  const createdMs = new Date(outcome.createdAt).getTime();
  if (!Number.isFinite(createdMs)) return false;
  const nowMs = now.getTime();
  const state: EffectivenessState = outcome.effectivenessState === "success" || outcome.effectivenessState === "fail" ? outcome.effectivenessState : "unknown";
  const deferredUntil = outcome.effectivenessDeferredUntil ? new Date(outcome.effectivenessDeferredUntil).getTime() : null;
  if (state !== "unknown") return false;
  if (deferredUntil && deferredUntil > nowMs) return false;
  return createdMs <= nowMs - REVIEW_MIN_AGE_MS;
}

export function computeDue(outcomes: ResolutionOutcome[], now = new Date()) {
  const nowMs = now.getTime();
  const dueItems: ResolutionOutcome[] = [];
  const failCodeCounts = new Map<ResolutionOutcomeCode, number>();
  const failReasonCounts = new Map<string, number>();
  const failRequestCounts = new Map<string, number>();
  for (const outcome of outcomes) {
    const createdMs = new Date(outcome.createdAt).getTime();
    if (!Number.isFinite(createdMs)) continue;
    const state: EffectivenessState =
      outcome.effectivenessState === "success" || outcome.effectivenessState === "fail" ? outcome.effectivenessState : "unknown";
    const deferredUntil = outcome.effectivenessDeferredUntil ? new Date(outcome.effectivenessDeferredUntil).getTime() : null;
    const sanitized = sanitizeEffectivenessFields(outcome);
    const normalized: ResolutionOutcome = {
      ...outcome,
      effectivenessReason: sanitized.reason,
      effectivenessNote: sanitized.note,
      effectivenessSource: sanitized.source,
    };
    if (state === "unknown" && (!deferredUntil || deferredUntil <= nowMs) && createdMs <= nowMs - REVIEW_MIN_AGE_MS) {
      dueItems.push(normalized);
    }
    if (state === "fail") {
      failCodeCounts.set(outcome.code, (failCodeCounts.get(outcome.code) ?? 0) + 1);
      if (sanitized.reason) {
        failReasonCounts.set(sanitized.reason, (failReasonCounts.get(sanitized.reason) ?? 0) + 1);
      }
      if (outcome.requestId && createdMs >= nowMs - LATER_WINDOW_MS) {
        failRequestCounts.set(outcome.requestId, (failRequestCounts.get(outcome.requestId) ?? 0) + 1);
      }
    }
  }
  dueItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const topFailedCodes = Array.from(failCodeCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([code, count]) => ({ code, count }));
  const topFailReasons = Array.from(failReasonCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([reason, count]) => ({ reason, count }));
  const repeatFailedRequestIds = Array.from(failRequestCounts.entries())
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .map(([requestId, count]) => ({ requestId, count }));
  const insights: EffectivenessInsights = { topFailedCodes, topFailReasons, repeatFailedRequestIds };
  return { dueItems, insights };
}
