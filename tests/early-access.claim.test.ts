/// <reference types="vitest/globals" />
import { beforeEach, describe, expect, it, vi } from "vitest";

const invitesStore: any[] = [];
const allowlistStore: any[] = [];

class Query {
  table: string;
  mode: "select" | "update" = "select";
  filters: { field: string; value: any; compare: "eq" | "is" }[] = [];
  orderField: string | null = null;
  ascending = true;
  updateValues: Record<string, any> = {};

  constructor(table: string) {
    this.table = table;
  }

  select() {
    return this;
  }
  eq(field: string, value: any) {
    this.filters.push({ field, value, compare: "eq" });
    return this;
  }
  is(field: string, value: any) {
    this.filters.push({ field, value, compare: "is" });
    return this;
  }
  order(field: string, opts?: { ascending?: boolean }) {
    this.orderField = field;
    this.ascending = opts?.ascending ?? true;
    return this;
  }
  limit(count = 1) {
    return { data: this.getRows().slice(0, count) };
  }
  insert(payload: any) {
    const target = this.table === "early_access_invites" ? invitesStore : allowlistStore;
    const row = Array.isArray(payload) ? payload[0] : payload;
    const newRow = { ...row, id: row.id ?? `id_${target.length + 1}` };
    target.push(newRow);
    return {
      select: () => ({
        maybeSingle: () => ({ data: newRow, error: null }),
      }),
    };
  }
  update(values: Record<string, any>) {
    this.mode = "update";
    this.updateValues = values;
    return this;
  }
  upsert(payload: any) {
    const idx = allowlistStore.findIndex((row) => row.email_hash === payload.email_hash);
    if (idx >= 0) {
      allowlistStore[idx] = { ...allowlistStore[idx], ...payload };
    } else {
      allowlistStore.push({ ...payload, id: payload.id ?? `id_${allowlistStore.length + 1}` });
    }
    return { error: null };
  }
  then(resolve: (value: any) => void) {
    if (this.mode === "update") {
      const rows = this.getRows();
      rows.forEach((row) => Object.assign(row, this.updateValues));
    }
    return resolve({});
  }
  private getRows() {
    let rows = this.table === "early_access_invites" ? invitesStore : allowlistStore;
    for (const f of this.filters) {
      rows = rows.filter((row) => {
        if (f.compare === "eq") return row[f.field] === f.value;
        if (f.compare === "is") return (row[f.field] ?? null) === f.value;
        return false;
      });
    }
    if (this.orderField) {
      rows = [...rows].sort((a, b) => {
        const aVal = a[this.orderField!];
        const bVal = b[this.orderField!];
        if (aVal === bVal) return 0;
        return this.ascending ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
      });
    }
    return rows;
  }
}

vi.mock("@/lib/supabase/service", () => ({
  createServiceRoleClient: () => ({
    from: (table: string) => new Query(table),
  }),
}));

vi.mock("@/lib/rbac", () => ({
  getUserRole: vi.fn(async () => ({ role: "user" })),
  isOpsRole: (role: string) => role === "admin" || role === "ops" || role === "super_admin",
}));

vi.mock("@/lib/monetisation", () => ({
  logMonetisationEvent: vi.fn(async () => null),
}));

describe("early access invite claim flow", () => {
  beforeEach(() => {
    invitesStore.length = 0;
    allowlistStore.length = 0;
    process.env.EARLY_ACCESS_MODE = "on";
  });

  it("claims an invite on login and allows access", async () => {
    const { createInvite } = await import("@/lib/early-access/invites");
    const { getEarlyAccessDecision } = await import("@/lib/early-access");
    await createInvite({ email: "pending@example.com", invitedBy: "ops-user", now: new Date("2024-05-01T00:00:00.000Z") });
    const decision = await getEarlyAccessDecision({ userId: "user-claim", email: "pending@example.com" });
    expect(decision.allowed).toBe(true);
    expect(decision.source).toBe("db_email");
    expect(allowlistStore[0]?.user_id).toBe("user-claim");
    expect(invitesStore[0]?.claimed_user_id).toBe("user-claim");
  });
});
