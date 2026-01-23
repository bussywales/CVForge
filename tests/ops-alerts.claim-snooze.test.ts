/// <reference types="vitest/globals" />
import { describe, expect, it, vi } from "vitest";
import { claimAlert, releaseAlert, getAlertOwnershipMap } from "@/lib/ops/alerts-ownership";
import { snoozeAlert, unsnoozeAlert, getSnoozeMap } from "@/lib/ops/alerts-snooze";

vi.mock("@/lib/supabase/service", () => {
  const store: Record<string, any[]> = { ops_alert_ownership: [], ops_alert_snoozes: [] };

  const makeSelectBuilder = (table: string, filters: ((row: any) => boolean)[] = []) => {
    const applyFilters = () => filters.reduce((rows, filter) => rows.filter(filter), store[table]);
    const builder: any = {
      eq: (field: string, value: any) => makeSelectBuilder(table, [...filters, (row) => row[field] === value]),
      gte: (field: string, value: any) =>
        makeSelectBuilder(table, [...filters, (row) => new Date(row[field]).getTime() >= new Date(value).getTime()]),
      order: () => builder,
      limit: async () => ({ data: applyFilters(), error: null }),
      then: (onFulfilled: any, onRejected: any) => builder.limit().then(onFulfilled, onRejected),
    };
    return builder;
  };

  const makeUpdateBuilder = (table: string, patch: any, filters: ((row: any) => boolean)[] = []) => {
    const builder: any = {
      eq: (field: string, value: any) => makeUpdateBuilder(table, patch, [...filters, (row) => row[field] === value]),
      then: (onFulfilled: any, onRejected: any) => {
        store[table] = store[table].map((row) => (filters.every((fn) => fn(row)) ? { ...row, ...patch } : row));
        return Promise.resolve({ data: store[table] }).then(onFulfilled, onRejected);
      },
    };
    return builder;
  };

  const makeDeleteBuilder = (table: string, filters: ((row: any) => boolean)[] = []) => {
    const builder: any = {
      eq: (field: string, value: any) => makeDeleteBuilder(table, [...filters, (row) => row[field] === value]),
      then: (onFulfilled: any, onRejected: any) => {
        store[table] = store[table].filter((row) => !filters.every((fn) => fn(row)));
        return Promise.resolve({ data: [] }).then(onFulfilled, onRejected);
      },
    };
    return builder;
  };

  function from(table: string) {
    return {
      upsert: async (payload: any) => {
        const rows = Array.isArray(payload) ? payload : [payload];
        rows.forEach((row) => {
          const target = store[table];
          if (table === "ops_alert_ownership") {
            const idx = target.findIndex((r) => r.alert_key === row.alert_key && r.window_label === row.window_label);
            if (idx >= 0) target[idx] = { ...target[idx], ...row };
            else target.push(row);
          } else {
            const idx = target.findIndex((r) => r.alert_key === row.alert_key && r.window_label === row.window_label);
            if (idx >= 0) target[idx] = { ...target[idx], ...row };
            else target.push(row);
          }
        });
        return { data: rows };
      },
      update: (patch: any) => makeUpdateBuilder(table, patch),
      delete: () => makeDeleteBuilder(table),
      select: () => makeSelectBuilder(table),
    };
  }
  return {
    createServiceRoleClient: () => ({ from }),
    __store: store,
  };
});

describe("ops alerts ownership/snooze helpers", () => {
  it("claims and returns ownership map with TTL", async () => {
    const now = new Date("2024-01-01T00:00:00Z");
    await claimAlert({ alertKey: "ops_alert_test", windowLabel: "15m", actorId: "user-1", now });
    const map = await getAlertOwnershipMap({ windowLabel: "15m", now });
    expect(map["ops_alert_test"]?.claimedByUserId).toBe("user-1");
    expect(new Date(map["ops_alert_test"].expiresAt).getTime()).toBeGreaterThan(now.getTime());
    await releaseAlert({ alertKey: "ops_alert_test", windowLabel: "15m", actorId: "user-1", now });
    const afterRelease = await getAlertOwnershipMap({ windowLabel: "15m", now });
    expect(afterRelease["ops_alert_test"]).toBeUndefined();
  });

  it("snoozes and unsnoozes alerts", async () => {
    const now = new Date("2024-01-01T00:00:00Z");
    await snoozeAlert({ alertKey: "ops_alert_test", windowLabel: "15m", minutes: 60, actorId: "user-1", now });
    const snoozes = await getSnoozeMap({ windowLabel: "15m", now });
    expect(snoozes["ops_alert_test"]?.untilAt).toBeDefined();
    await unsnoozeAlert({ alertKey: "ops_alert_test", windowLabel: "15m" });
    const after = await getSnoozeMap({ windowLabel: "15m", now });
    expect(after["ops_alert_test"]).toBeUndefined();
  });
});
