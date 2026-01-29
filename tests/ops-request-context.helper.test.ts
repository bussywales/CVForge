/// <reference types="vitest/globals" />
import { describe, expect, it, vi } from "vitest";
import { maskEmail, upsertRequestContext } from "@/lib/ops/ops-request-context";

vi.mock("@/lib/supabase/service", () => {
  const store: Record<string, any[]> = { ops_request_context: [] };

  const makeSelectBuilder = (table: string, filters: ((row: any) => boolean)[] = []) => {
    const applyFilters = () => store[table].filter((row) => filters.every((fn) => fn(row)));
    return {
      eq: (field: string, value: any) => makeSelectBuilder(table, [...filters, (row) => row[field] === value]),
      maybeSingle: async () => {
        const rows = applyFilters();
        return { data: rows[0] ?? null, error: null };
      },
      single: async () => {
        const rows = applyFilters();
        return { data: rows[0] ?? null, error: null };
      },
    };
  };

  const makeUpdateBuilder = (table: string, patch: any, filters: ((row: any) => boolean)[] = []) => ({
    eq: (_field: string, _value: any) => ({
      select: () => ({
        single: async () => {
          const rows = store[table].map((row) => (filters.every((fn) => fn(row)) ? { ...row, ...patch } : row));
          store[table] = rows;
          const match = rows.find((row) => filters.every((fn) => fn(row)));
          return { data: match ?? null, error: null };
        },
      }),
    }),
  });

  const from = (table: string) => ({
    select: () => makeSelectBuilder(table),
    insert: (payload: any) => ({
      select: () => ({
        single: async () => {
          store[table].push(payload);
          return { data: payload, error: null };
        },
      }),
    }),
    update: (patch: any) => makeUpdateBuilder(table, patch),
  });

  return { createServiceRoleClient: () => ({ from }), __store: store };
});

describe("ops request context helper", () => {
  it("masks emails deterministically", () => {
    expect(maskEmail("buzzy@example.com")).toBe("bu***@e******.com");
  });

  it("upserts without overwriting existing user_id and merges sources", async () => {
    const first = await upsertRequestContext({
      requestId: "req_1",
      userId: "user_1",
      email: "alpha@example.com",
      source: "ops_audit",
      now: new Date("2024-01-01T00:00:00.000Z"),
      meta: { ref: "first" },
    });
    expect(first?.user_id).toBe("user_1");
    expect(first?.sources).toEqual(["ops_audit"]);

    const second = await upsertRequestContext({
      requestId: "req_1",
      userId: "user_2",
      source: "training",
      now: new Date("2024-01-01T00:05:00.000Z"),
      meta: { ref: "second", added: "yes" },
    });
    expect(second?.user_id).toBe("user_1");
    expect(second?.sources).toEqual(expect.arrayContaining(["ops_audit", "training"]));
    expect(second?.meta?.ref).toBe("first");
    expect(second?.meta?.added).toBe("yes");
  });
});
