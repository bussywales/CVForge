import { describe, expect, it } from "vitest";
import { buildSupportSnippet } from "@/lib/observability/support-snippet";

describe("buildSupportSnippet", () => {
  it("formats support snippet with all fields", () => {
    const snippet = buildSupportSnippet({
      requestId: "req_abc123",
      action: "Start checkout",
      path: "/app/billing?pack=pro",
      code: "INVALID_MODE",
    });

    expect(snippet).toContain("CVForge support request");
    expect(snippet).toContain("Action: Start checkout");
    expect(snippet).toContain("Page: /app/billing?pack=pro");
    expect(snippet).toContain("Reference: req_abc123");
    expect(snippet).toContain("Code: INVALID_MODE");
  });

  it("omits reference when requestId is missing", () => {
    const snippet = buildSupportSnippet({
      requestId: null,
      action: "Open portal",
      path: "/app/billing",
      code: "PORTAL_ERROR",
    });

    expect(snippet).toContain("Action: Open portal");
    expect(snippet).not.toContain("Reference:");
    expect(snippet).toContain("Code: PORTAL_ERROR");
  });
});
