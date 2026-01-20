import { describe, expect, it } from "vitest";
import { detectCreditDelay } from "@/lib/billing/billing-credit-delay";

const checkoutEntry = { kind: "checkout_success", at: "2024-02-10T10:00:00.000Z", status: "ok", label: "Checkout success" } as any;
const creditEntry = { kind: "credits_applied", at: "2024-02-10T10:05:00.000Z", status: "ok", label: "Credits applied" } as any;

describe("detectCreditDelay", () => {
  it("returns ok when credits applied after checkout", () => {
    const res = detectCreditDelay({ timeline: [checkoutEntry, creditEntry], now: new Date("2024-02-10T10:10:00.000Z") });
    expect(res.state).toBe("ok");
  });

  it("returns watching when checkout is recent", () => {
    const res = detectCreditDelay({ timeline: [checkoutEntry], now: new Date("2024-02-10T10:05:00.000Z"), windowMinutes: 15 });
    expect(res.state).toBe("watching");
  });

  it("returns delayed when checkout is old and no credits", () => {
    const res = detectCreditDelay({ timeline: [checkoutEntry], now: new Date("2024-02-10T10:30:00.000Z"), windowMinutes: 15 });
    expect(res.state).toBe("delayed");
  });
});
