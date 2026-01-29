import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { RUNBOOK_META } from "@/lib/ops/runbook-sections";

describe("runbook meta", () => {
  it("tracks the latest changelog version", () => {
    const changelog = readFileSync("CHANGELOG.md", "utf8");
    const match = changelog.match(/^##\s+(v\d+\.\d+\.\d+[a-z]?)/m);
    expect(match).not.toBeNull();
    if (!match) return;
    expect(RUNBOOK_META.lastUpdatedVersion).toBe(match[1]);
  });
});
