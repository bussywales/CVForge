import { describe, expect, it } from "vitest";
import { mapDecisionToOutcome } from "@/lib/offer-pack";

describe("offer decision mapping", () => {
  it("maps decisions to outcome status and reason", () => {
    expect(mapDecisionToOutcome("accepted")).toEqual({ status: "offer", reason: "accepted" });
    expect(mapDecisionToOutcome("declined")).toEqual({ status: "rejected", reason: "declined_offer" });
    expect(mapDecisionToOutcome("asked_for_time")).toEqual({ status: "offer", reason: "asked_for_time" });
    expect(mapDecisionToOutcome("negotiating")).toEqual({ status: "offer", reason: "negotiating" });
  });
});
