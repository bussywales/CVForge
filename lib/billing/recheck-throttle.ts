const WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const MAX_REQUESTS = 6;
const store: Record<string, number[]> = {};

function makeKey(userId: string | null, ip: string | null) {
  return `${userId ?? "anon"}:${ip ?? "ip_unknown"}`;
}

export function checkRecheckThrottle(userId: string | null, ip: string | null, now = Date.now()) {
  const key = makeKey(userId, ip);
  const windowStart = now - WINDOW_MS;
  const history = (store[key] ?? []).filter((ts) => ts >= windowStart);
  history.push(now);
  store[key] = history;
  const remaining = MAX_REQUESTS - history.length;
  const retryAfterSec = Math.max(0, Math.ceil((history[0] + WINDOW_MS - now) / 1000));
  return {
    allowed: history.length <= MAX_REQUESTS,
    retryAfterSec,
    remaining,
  };
}

export function resetRecheckThrottle() {
  Object.keys(store).forEach((key) => delete store[key]);
}
