import type { RoleFitResult } from "@/lib/role-fit";

const METRIC_REGEX =
  /(\d|%|£|\$|€|\b(hours?|hrs?|days?|weeks?|months?|years?|mins?|minutes?)\b|\b(kpi|sla|mttr)\b)/i;

export function pickTopSignals(
  roleFit: RoleFitResult | null,
  count = 2
): string[] {
  if (!roleFit) {
    return [];
  }

  const byWeight = <T extends { weight: number }>(items: T[]) =>
    [...items].sort((a, b) => b.weight - a.weight);

  const matched = byWeight(roleFit.matchedSignals ?? [])
    .map((signal) => signal.label)
    .filter(Boolean);

  if (matched.length > 0) {
    return uniqueLabels(matched).slice(0, count);
  }

  const gaps = byWeight(roleFit.gapSignals ?? [])
    .map((signal) => signal.label)
    .filter(Boolean);

  return uniqueLabels(gaps).slice(0, count);
}

export function pickBestMetric(
  achievements: Array<{ metrics: string | null }>,
  limit = 120
) {
  const metrics = achievements
    .map((achievement) => achievement.metrics?.trim() || "")
    .filter(Boolean);

  const numeric = metrics.find((metric) => METRIC_REGEX.test(metric));
  const candidate = numeric ?? metrics[0];
  if (!candidate) {
    return null;
  }
  return trimMetric(candidate, limit);
}

export function trimMetric(value: string, limit = 120) {
  const trimmed = value.trim();
  if (trimmed.length <= limit) {
    return trimmed;
  }
  return `${trimmed.slice(0, Math.max(0, limit - 3)).trimEnd()}...`;
}

export function getOutreachStageLabel(stage: string | null) {
  switch (stage) {
    case "applied_sent":
      return "Applied sent";
    case "followup_1":
      return "Follow-up 1";
    case "followup_2":
      return "Follow-up 2";
    case "final_nudge":
      return "Final nudge";
    case "replied":
      return "Replied";
    case "closed":
      return "Closed";
    default:
      return "Not started";
  }
}

function uniqueLabels(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
