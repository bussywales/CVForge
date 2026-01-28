/// <reference types="vitest/globals" />
import { describe, expect, it } from "vitest";
import { buildAckLink } from "@/lib/ops/alerts-ack-link";

describe("ack link builder", () => {
  it("builds link with token and returnTo", () => {
    const link = buildAckLink("tok_test", { returnTo: "/app/ops/alerts" });
    expect(link).toContain("/api/alerts/ack");
    expect(link).toContain("token=tok_test");
    expect(link).toContain("returnTo=%2Fapp%2Fops%2Falerts");
  });
});
