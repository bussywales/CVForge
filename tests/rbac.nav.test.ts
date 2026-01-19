import { describe, expect, it } from "vitest";
import { canSeeOpsNav } from "@/lib/rbac";

describe("ops nav visibility", () => {
  it("allows ops/admin/super_admin", () => {
    expect(canSeeOpsNav("support")).toBe(true);
    expect(canSeeOpsNav("admin")).toBe(true);
    expect(canSeeOpsNav("super_admin")).toBe(true);
  });

  it("hides from normal user", () => {
    expect(canSeeOpsNav("user")).toBe(false);
  });
});

