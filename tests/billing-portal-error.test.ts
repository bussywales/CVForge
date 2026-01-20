import { describe, expect, it } from "vitest";
import { parsePortalError } from "@/lib/billing/portal-error";

describe("portal error parser", () => {
  it("extracts requestId when portal_error flag present", () => {
    const info = parsePortalError({ portal_error: "1", req: "req_123", code: "PORTAL_ERROR" });
    expect(info.show).toBe(true);
    expect(info.requestId).toBe("req_123");
    expect(info.code).toBe("PORTAL_ERROR");
  });

  it("returns false when flag missing", () => {
    const info = parsePortalError({ req: "req_123" });
    expect(info.show).toBe(false);
  });
});

