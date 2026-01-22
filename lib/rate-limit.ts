type BucketKey = string;

type RateLimitRecord = {
  route: string;
  category?: string | null;
  at: number;
};

const windowStore: Record<BucketKey, number[]> = {};
const limitLog: RateLimitRecord[] = [];

function makeKey(route: string, identifier: string | null) {
  return `${route}:${identifier ?? "anon"}`;
}

export type RateLimitResult =
  | { allowed: true; remaining: number }
  | { allowed: false; retryAfterSeconds: number; status: 429 };

export function checkRateLimit({
  route,
  identifier,
  limit,
  windowMs,
  now = Date.now(),
  category,
}: {
  route: string;
  identifier: string | null;
  limit: number;
  windowMs: number;
  now?: number;
  category?: string | null;
}): RateLimitResult {
  const key = makeKey(route, identifier);
  const windowStart = now - windowMs;
  const history = (windowStore[key] ?? []).filter((ts) => ts >= windowStart);
  history.push(now);
  windowStore[key] = history;
  const remaining = Math.max(0, limit - history.length);
  if (history.length > limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((history[0] + windowMs - now) / 1000));
    limitLog.push({ route, category: category ?? null, at: now });
    return { allowed: false, retryAfterSeconds, status: 429 };
  }
  return { allowed: true, remaining };
}

export function getRateLimitSummary({ sinceMs }: { sinceMs: number }) {
  const recent = limitLog.filter((entry) => entry.at >= sinceMs);
  const byRoute = recent.reduce((map, entry) => {
    const current = map.get(entry.route) ?? 0;
    map.set(entry.route, current + 1);
    return map;
  }, new Map<string, number>());
  const byCategory = recent.reduce((map, entry) => {
    const key = entry.category ?? "unknown";
    map.set(key, (map.get(key) ?? 0) + 1);
    return map;
  }, new Map<string, number>());
  const topLimitedRoutes24h = Array.from(byRoute.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([route, count]) => ({ route, count }));
  const rateLimitHits = {
    billing_recheck: byRoute.get("billing_recheck") ?? 0,
    monetisation_log: byRoute.get("monetisation_log") ?? 0,
    ops_actions: (byCategory.get("ops_action") ?? 0) + (byRoute.get("ops_system_status") ?? 0),
  };
  return { rateLimitHits, topLimitedRoutes24h };
}

export function getRateLimitLog({ sinceMs }: { sinceMs: number }) {
  return limitLog.filter((entry) => entry.at >= sinceMs);
}

export function resetRateLimitStores() {
  Object.keys(windowStore).forEach((key) => delete windowStore[key]);
  limitLog.length = 0;
}
