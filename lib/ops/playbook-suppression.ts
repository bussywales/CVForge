import type { IncidentGroup } from "@/lib/ops/incidents-shared";
import type { ResolutionOutcome } from "@/lib/ops/ops-resolution-outcomes";

type SuppressionResult = { suppressed: boolean; outcome?: ResolutionOutcome };

function outcomeFamily(code?: string | null) {
  if (!code) return "unknown";
  if (code.includes("PORTAL")) return "portal";
  if (code.includes("WEBHOOK")) return "webhook";
  if (code.includes("CREDITS")) return "delay";
  return "other";
}

export function shouldSuppressPlaybook({
  group,
  outcomes,
  now = new Date(),
}: {
  group: IncidentGroup;
  outcomes: ResolutionOutcome[];
  now?: Date;
}): SuppressionResult {
  const primaryRequestId = group.sampleRequestIds[0] ?? group.incidents[0]?.requestId ?? null;
  const groupUserId = group.incidents[0]?.userId ?? null;
  const windowMs = 24 * 60 * 60 * 1000;
  const families: Record<string, boolean> = {
    portal: true,
    webhook: true,
    delay: true,
  };
  for (const outcome of outcomes) {
    const created = new Date(outcome.createdAt).getTime();
    if (Number.isNaN(created)) continue;
    if (now.getTime() - created > windowMs) continue;
    const fam = outcomeFamily(outcome.code);
    if (!families[fam]) continue;
    const sameRequest = outcome.requestId && primaryRequestId && outcome.requestId === primaryRequestId;
    const sameUser = outcome.userId && groupUserId && outcome.userId === groupUserId;
    if (sameRequest || sameUser) {
      return { suppressed: true, outcome };
    }
  }
  return { suppressed: false };
}
