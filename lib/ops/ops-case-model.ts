export type CaseWindow = "15m" | "24h" | "7d";

export function resolveCaseWindow(input?: string | null): CaseWindow {
  if (input === "24h" || input === "7d" || input === "15m") return input;
  return "15m";
}

export function windowToMs(window: CaseWindow) {
  if (window === "7d") return 7 * 24 * 60 * 60 * 1000;
  if (window === "24h") return 24 * 60 * 60 * 1000;
  return 15 * 60 * 1000;
}

export function buildCaseRange({
  window,
  now = new Date(),
}: {
  window: CaseWindow;
  now?: Date;
}) {
  const toIso = now.toISOString();
  const fromIso = new Date(now.getTime() - windowToMs(window)).toISOString();
  return { windowLabel: window, fromIso, toIso };
}

export function buildCaseKey({
  requestId,
  userId,
  email,
}: {
  requestId?: string | null;
  userId?: string | null;
  email?: string | null;
}) {
  if (requestId) return { label: "Request", value: requestId };
  if (userId) return { label: "User", value: userId };
  if (email) return { label: "Email", value: email };
  return { label: "Case", value: "—" };
}
