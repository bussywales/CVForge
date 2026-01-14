import { describe, expect, it } from "vitest";
import { isBlockedJobFetchUrl } from "@/lib/job-fetch-policy";

describe("isBlockedJobFetchUrl", () => {
  it("blocks Indeed variants", () => {
    const result = isBlockedJobFetchUrl(new URL("https://uk.indeed.com/viewjob?id=123"));
    expect(result.blocked).toBe(true);
    expect(result.reason).toBe("BLOCKED_SOURCE_INDEED");
  });

  it("blocks LinkedIn job URLs", () => {
    const result = isBlockedJobFetchUrl(new URL("https://www.linkedin.com/jobs/view/123"));
    expect(result.blocked).toBe(true);
    expect(result.reason).toBe("BLOCKED_SOURCE_LINKEDIN");
  });

  it("allows other domains", () => {
    const result = isBlockedJobFetchUrl(new URL("https://example.com/jobs/789"));
    expect(result.blocked).toBe(false);
  });
});
