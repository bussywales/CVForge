/// <reference types="vitest/globals" />
import { describe, expect, it, vi, beforeEach } from "vitest";
import { resolveRequestContext } from "@/lib/ops/ops-request-context";

const store: Record<string, any[]> = {
  ops_request_context: [],
  ops_audit_log: [],
  application_activities: [],
};

const makeQuery = (table: string) => {
  let filters: Array<(row: any) => boolean> = [];
  let orFilters: Array<(row: any) => boolean> = [];
  let limitCount: number | null = null;
  const run = () => {
    let rows = store[table] ?? [];
    if (filters.length) rows = rows.filter((row) => filters.every((fn) => fn(row)));
    if (orFilters.length) rows = rows.filter((row) => orFilters.some((fn) => fn(row)));
    if (typeof limitCount === "number") rows = rows.slice(0, limitCount);
    return rows;
  };
  const query: any = {
    select: () => query,
    eq: (field: string, value: any) => {
      filters.push((row) => row[field] === value);
      return query;
    },
    gte: (field: string, value: string) => {
      filters.push((row) => new Date(row[field] ?? 0).getTime() >= new Date(value).getTime());
      return query;
    },
    like: (field: string, pattern: string) => {
      const needle = pattern.replace(/%/g, "");
      filters.push((row) => String(row[field] ?? "").includes(needle));
      return query;
    },
    or: (expr: string) => {
      if (expr.includes("meta->>requestId.eq.")) {
        const value = expr.split("meta->>requestId.eq.")[1].split(",")[0];
        orFilters.push((row) => row.meta?.requestId === value);
      }
      if (expr.includes("meta->>req.eq.")) {
        const value = expr.split("meta->>req.eq.")[1].split(",")[0];
        orFilters.push((row) => row.meta?.req === value);
      }
      if (expr.includes("type.ilike.monetisation.webhook_error%")) {
        orFilters.push((row) => String(row.type ?? "").startsWith("monetisation.webhook_error"));
      }
      if (expr.includes("type.ilike.monetisation.webhook_failure%")) {
        orFilters.push((row) => String(row.type ?? "").startsWith("monetisation.webhook_failure"));
      }
      return query;
    },
    order: () => query,
    limit: (count: number) => {
      limitCount = count;
      return query;
    },
    maybeSingle: async () => ({ data: run()[0] ?? null, error: null }),
    single: async () => ({ data: run()[0] ?? null, error: null }),
  };
  query.then = (resolve: any, reject: any) => Promise.resolve({ data: run(), error: null }).then(resolve, reject);
  return query;
};

vi.mock("@/lib/monetisation", () => ({
  logMonetisationEvent: async () => undefined,
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceRoleClient: () => ({
    from: (table: string) => ({
      select: () => makeQuery(table),
      insert: (payload: any) => ({
        select: () => ({
          single: async () => {
            store[table].push(payload);
            return { data: payload, error: null };
          },
        }),
      }),
      update: (patch: any) => ({
        eq: (field: string, value: any) => ({
          select: () => ({
            single: async () => {
              store[table] = store[table].map((row) => (row[field] === value ? { ...row, ...patch } : row));
              const match = store[table].find((row) => row[field] === value) ?? null;
              return { data: match, error: null };
            },
          }),
        }),
      }),
    }),
  }),
}));

describe("ops request context resolver", () => {
  beforeEach(() => {
    store.ops_request_context = [];
    store.ops_audit_log = [];
    store.application_activities = [];
  });

  it("returns canonical context when present", async () => {
    store.ops_request_context.push({
      request_id: "req_canon",
      user_id: "user_1",
      email_masked: null,
      source: "manual_admin_attach",
      confidence: "high",
      evidence: {},
      sources: ["manual_admin_attach"],
      first_seen_at: "2024-01-01T00:00:00.000Z",
      last_seen_at: "2024-01-01T00:00:00.000Z",
      last_seen_path: null,
      meta: {},
      created_at: "2024-01-01T00:00:00.000Z",
      updated_at: "2024-01-01T00:00:00.000Z",
    });
    const result = await resolveRequestContext({ requestId: "req_canon", window: "15m", now: new Date("2024-01-01T00:05:00.000Z") });
    expect(result?.user_id).toBe("user_1");
    expect(result?.source).toBe("manual_admin_attach");
  });

  it("resolves from audit touchpoint", async () => {
    store.ops_audit_log.push({
      id: 1,
      created_at: "2024-01-01T00:04:00.000Z",
      target_user_id: "user_audit",
      action: "ops_alert_ack",
      meta: { requestId: "req_audit" },
    });
    const result = await resolveRequestContext({ requestId: "req_audit", window: "15m", now: new Date("2024-01-01T00:10:00.000Z") });
    expect(result?.user_id).toBe("user_audit");
    expect(result?.source).toBe("ops_audit");
    expect(result?.confidence).toBe("high");
  });

  it("resolves from outcomes touchpoint", async () => {
    store.application_activities.push({
      id: "act_1",
      type: "monetisation.ops_resolution_outcome_set",
      body: JSON.stringify({ requestId: "req_outcome", userId: "user_outcome", code: "OTHER" }),
      occurred_at: "2024-01-01T00:02:00.000Z",
      created_at: "2024-01-01T00:02:00.000Z",
    });
    const result = await resolveRequestContext({ requestId: "req_outcome", window: "15m", now: new Date("2024-01-01T00:10:00.000Z") });
    expect(result?.user_id).toBe("user_outcome");
    expect(result?.source).toBe("ops_outcome");
  });

  it("does not resolve when touchpoint lacks userId", async () => {
    store.ops_audit_log.push({
      id: 2,
      created_at: "2024-01-01T00:04:00.000Z",
      target_user_id: null,
      action: "ops_alert_ack",
      meta: { requestId: "req_missing" },
    });
    const result = await resolveRequestContext({ requestId: "req_missing", window: "15m", now: new Date("2024-01-01T00:10:00.000Z") });
    expect(result?.user_id ?? null).toBeNull();
    expect(store.ops_request_context.length).toBe(0);
  });
});
