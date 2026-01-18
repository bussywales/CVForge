import { describe, expect, it } from "vitest";
import { buildSupportSnippet } from "@/lib/observability/support-snippet";

describe("ops incidents helpers", () => {
  it("builds support snippet with reference and code", () => {
    const snippet = buildSupportSnippet({
      requestId: "req_test123",
      action: "Checkout",
      path: "/app/billing",
      code: "INVALID_MODE",
    });

    expect(snippet).toContain("req_test123");
    expect(snippet).toContain("Action: Checkout");
    expect(snippet).toContain("Code: INVALID_MODE");
  });
});
