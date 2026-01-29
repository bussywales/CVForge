/// <reference types="vitest/globals" />
import { describe, expect, it, vi } from "vitest";
import { createTrainingScenario, deactivateScenario, listTrainingScenarios } from "@/lib/ops/training-scenarios";

vi.mock("@/lib/supabase/service", () => {
  const store: Record<string, any[]> = { ops_training_scenarios: [] };
  let counter = 0;

  const makeSelectBuilder = (
    table: string,
    filters: ((row: any) => boolean)[] = [],
    orderField?: string,
    ascending = false,
    limitValue?: number
  ) => {
    const applyFilters = () => {
      let rows = store[table].filter((row) => filters.every((fn) => fn(row)));
      if (orderField) {
        rows = rows.slice().sort((a, b) => {
          const aVal = a[orderField];
          const bVal = b[orderField];
          if (aVal === bVal) return 0;
          return ascending ? (aVal > bVal ? 1 : -1) : aVal > bVal ? -1 : 1;
        });
      }
      return typeof limitValue === "number" ? rows.slice(0, limitValue) : rows;
    };
    const builder: any = {
      eq: (field: string, value: any) => makeSelectBuilder(table, [...filters, (row) => row[field] === value], orderField, ascending, limitValue),
      order: (field: string, opts?: { ascending?: boolean }) => makeSelectBuilder(table, filters, field, opts?.ascending ?? false, limitValue),
      limit: (limit: number) => makeSelectBuilder(table, filters, orderField, ascending, limit),
      then: (onFulfilled: any, onRejected: any) =>
        Promise.resolve({ data: applyFilters(), error: null }).then(onFulfilled, onRejected),
    };
    return builder;
  };

  const makeUpdateBuilder = (table: string, patch: any, filters: ((row: any) => boolean)[] = []) => {
    const builder: any = {
      eq: (field: string, value: any) => makeUpdateBuilder(table, patch, [...filters, (row) => row[field] === value]),
      select: () => ({
        single: async () => {
          store[table] = store[table].map((row) => (filters.every((fn) => fn(row)) ? { ...row, ...patch } : row));
          const row = store[table].find((item) => filters.every((fn) => fn(item)));
          return { data: row ?? null, error: null };
        },
      }),
    };
    return builder;
  };

  const from = (table: string) => ({
    insert: (payload: any) => {
      const row = { ...payload, id: `scn_${counter++}` };
      store[table].push(row);
      return {
        select: () => ({
          single: async () => ({ data: row, error: null }),
        }),
      };
    },
    select: () => makeSelectBuilder(table),
    update: (patch: any) => makeUpdateBuilder(table, patch),
  });

  return { createServiceRoleClient: () => ({ from }), __store: store };
});

describe("ops training scenarios helper", () => {
  it("creates, lists, and deactivates scenarios with sanitized meta", async () => {
    const now = new Date("2024-01-01T00:00:00.000Z");
    const created = await createTrainingScenario({
      type: "alerts_test",
      userId: "user-1",
      now,
      meta: { note: "see http://example.com" },
    });
    expect(created.scenario_type).toBe("alerts_test");
    expect(created.meta.note).toBe("[url-redacted]");

    const list = await listTrainingScenarios({ userId: "user-1", limit: 10, activeOnly: true });
    expect(list.length).toBe(1);
    expect(list[0].id).toBe(created.id);

    await deactivateScenario({ id: created.id });
    const after = await listTrainingScenarios({ userId: "user-1", limit: 10, activeOnly: true });
    expect(after.length).toBe(0);
  });
});
