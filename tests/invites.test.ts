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

  limit(count: number) {
    const data = this.getRows().slice(0, count);
    return Promise.resolve({ data });
  }

  maybeSingle() {
    const data = this.getRows()[0];
    return Promise.resolve({ data, error: null });
  }

  insert(payload: any) {
    const target = this.table === "early_access_invites" ? invitesStore : allowlistStore;
    const row = Array.isArray(payload) ? payload[0] : payload;
    const newRow = { ...row, id: row.id ?? `id_${target.length + 1}` };
    target.push(newRow);
    return {
      select: () => ({
        maybeSingle: () => Promise.resolve({ data: newRow, error: null }),
      }),
    };
  }

  update(values: Record<string, any>) {
    this.mode = "update";
    this.updateValues = values;
    return this;
  }

  upsert(payload: any) {
    const target = this.table === "early_access_invites" ? invitesStore : allowlistStore;
    const idx = target.findIndex((row) => row.email_hash === payload.email_hash);
    if (idx >= 0) {
      target[idx] = { ...target[idx], ...payload };
    } else {
      target.push({ ...payload, id: payload.id ?? `id_${target.length + 1}` });
    }
    return Promise.resolve({ error: null });
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
    for (const filter of this.filters) {
      rows = rows.filter((row) => {
        if (filter.compare === "eq") return row[filter.field] === filter.value;
        if (filter.compare === "is") return (row[filter.field] ?? null) === filter.value;
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

describe("early access invites helper", () => {
  beforeEach(() => {
    invitesStore.length = 0;
    allowlistStore.length = 0;
  });

  it("creates and finds an active invite", async () => {
    const { createInvite, findActiveInviteByEmailHash } = await import("@/lib/early-access/invites");
    const { hashEarlyAccessEmail } = await import("@/lib/early-access");
    const now = new Date("2024-01-01T00:00:00.000Z");
    const { token } = await createInvite({ email: "new@example.com", invitedBy: "ops-1", now });
    expect(token).toBeTruthy();
    const hash = hashEarlyAccessEmail("new@example.com");
    const active = await findActiveInviteByEmailHash(hash ?? "");
    expect(active?.token).toBe(token);
  });

  it("claims invite and upserts allowlist", async () => {
    const { createInvite, claimInviteForUser } = await import("@/lib/early-access/invites");
    const { hashEarlyAccessEmail } = await import("@/lib/early-access");
    const now = new Date("2024-02-01T00:00:00.000Z");
    await createInvite({ email: "claim@example.com", invitedBy: "ops-2", now });
    const result = await claimInviteForUser({ email: "claim@example.com", userId: "user-123", now: new Date("2024-02-02T00:00:00.000Z") });
    expect(result.status).toBe("claimed");
    expect(allowlistStore[0].user_id).toBe("user-123");
    const hash = hashEarlyAccessEmail("claim@example.com");
    expect(allowlistStore[0].email_hash).toBe(hash);
  });

  it("revokes expired invites", async () => {
    const { createInvite, claimInviteForUser, findActiveInviteByEmailHash } = await import("@/lib/early-access/invites");
    const { hashEarlyAccessEmail } = await import("@/lib/early-access");
    const now = new Date("2024-03-01T00:00:00.000Z");
    await createInvite({ email: "old@example.com", invitedBy: "ops-3", now, expiresAt: new Date("2024-03-02T00:00:00.000Z") });
    const result = await claimInviteForUser({ email: "old@example.com", userId: "user-x", now: new Date("2024-04-01T00:00:00.000Z") });
    expect(result.status).toBe("skipped");
    const hash = hashEarlyAccessEmail("old@example.com");
    const active = await findActiveInviteByEmailHash(hash ?? "");
    expect(active).toBeNull();
  });
});
