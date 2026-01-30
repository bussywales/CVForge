const PRIORITY_LABELS = ["p0", "p1", "p2", "p3"];

export function formatCasePriority(value?: unknown) {
  if (typeof value !== "string") return "P2";
  const lower = value.toLowerCase();
  if (PRIORITY_LABELS.includes(lower)) return lower.toUpperCase();
  if (lower === "high") return "P1";
  if (lower === "medium") return "P2";
  if (lower === "low") return "P3";
  return "P2";
}
