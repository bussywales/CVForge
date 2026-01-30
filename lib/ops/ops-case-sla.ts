import { normaliseCasePriority, type CasePriority } from "@/lib/ops/ops-case-workflow";

const SLA_TARGETS_MS: Record<CasePriority, number> = {
  p0: 15 * 60 * 1000,
  p1: 60 * 60 * 1000,
  p2: 4 * 60 * 60 * 1000,
  p3: 24 * 60 * 60 * 1000,
};

export function getCaseSlaTargetMs(priority: CasePriority | string | null | undefined) {
  const normalised = normaliseCasePriority(priority) ?? "p2";
  return SLA_TARGETS_MS[normalised];
}

export function computeCaseSla({
  priority,
  createdAt,
  now = new Date(),
}: {
  priority: CasePriority | string | null | undefined;
  createdAt: string | null | undefined;
  now?: Date;
}) {
  if (!createdAt) return null;
  const createdMs = new Date(createdAt).getTime();
  if (Number.isNaN(createdMs)) return null;
  const targetMs = getCaseSlaTargetMs(priority);
  const dueMs = createdMs + targetMs;
  const nowMs = now.getTime();
  const remainingMs = Math.max(0, dueMs - nowMs);
  return {
    dueAt: new Date(dueMs).toISOString(),
    remainingMs,
    breached: nowMs > dueMs,
    targetMs,
  };
}

