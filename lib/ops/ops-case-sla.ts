export type CasePriority = "p0" | "p1" | "p2" | "p3";

function normaliseCasePriority(value?: unknown): CasePriority | null {
  if (typeof value !== "string") return null;
  const lower = value.toLowerCase();
  if (lower === "p0" || lower === "p1" || lower === "p2" || lower === "p3") return lower;
  if (lower === "high") return "p1";
  if (lower === "medium") return "p2";
  if (lower === "low") return "p3";
  return null;
}

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
  dueAt,
  status,
  now = new Date(),
}: {
  priority: CasePriority | string | null | undefined;
  createdAt: string | null | undefined;
  dueAt?: string | null;
  status?: string | null;
  now?: Date;
}) {
  const normalisedPriority = normaliseCasePriority(priority) ?? "p2";
  let dueMs = dueAt ? new Date(dueAt).getTime() : Number.NaN;
  if (Number.isNaN(dueMs)) {
    if (!createdAt) return null;
    const createdMs = new Date(createdAt).getTime();
    if (Number.isNaN(createdMs)) return null;
    dueMs = createdMs + getCaseSlaTargetMs(normalisedPriority);
  }
  const nowMs = now.getTime();
  const deltaMs = dueMs - nowMs;
  const breached = deltaMs < 0;
  const remainingMs = breached ? Math.abs(deltaMs) : deltaMs;
  const paused = status === "waiting_on_user" || status === "waiting_on_provider";
  return {
    dueAt: new Date(dueMs).toISOString(),
    remainingMs,
    breached,
    paused,
    targetMs: getCaseSlaTargetMs(normalisedPriority),
  };
}

function formatSlaDuration(ms: number, allowZero: boolean) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  if (allowZero && totalSeconds < 60) return "0m";
  const totalMinutes = Math.max(1, Math.ceil(totalSeconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return remHours > 0 ? `${days}d ${remHours}h` : `${days}d`;
  }
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  return `${totalMinutes}m`;
}

export function formatCaseSlaLabel({
  remainingMs,
  breached,
  paused,
}: {
  remainingMs: number | null;
  breached: boolean;
  paused?: boolean;
}) {
  if (remainingMs === null) return "SLA due in: -";
  const duration = formatSlaDuration(remainingMs, breached);
  const base = breached ? `SLA breached by: ${duration}` : `SLA due in: ${duration}`;
  if (paused) return `${base} - paused (waiting)`;
  return base;
}
