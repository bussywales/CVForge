import { describe, expect, it } from "vitest";
import { buildReturnToUrl } from "@/lib/billing/pending-action";

describe("subscription resume return urls", () => {
  const applicationId = "123e4567-e89b-12d3-a456-426614174000";

  it("includes resume flag for pending actions", () => {
    const actions = [
      { type: "autopack_generate" as const },
      { type: "interview_pack_export" as const, variant: "standard" as const },
      { type: "application_kit_download" as const },
      { type: "answer_pack_generate" as const, mode: "standard" as const },
    ];

    actions.forEach((action) => {
      const url = buildReturnToUrl({
        ...action,
        applicationId,
        createdAt: Date.now(),
      } as any);
      expect(url).toContain("resume=1");
      expect(url).toContain(`/app/applications/${applicationId}`);
    });
  });
});
