import { describe, expect, it } from "vitest";
import { canAssignRole, isAdminRole, isOpsRole } from "@/lib/rbac";

describe("rbac helpers", () => {
  it("detects ops and admin roles", () => {
    expect(isOpsRole("support")).toBe(true);
    expect(isOpsRole("user")).toBe(false);
    expect(isAdminRole("admin")).toBe(true);
    expect(isAdminRole("support")).toBe(false);
  });

  it("enforces super_admin grant rules", () => {
    expect(canAssignRole("admin", "super_admin")).toBe(false);
    expect(canAssignRole("super_admin", "admin")).toBe(true);
  });
});
