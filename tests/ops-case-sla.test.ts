import { describe, expect, it } from "vitest";
import { computeCaseSla } from "@/lib/ops/ops-case-sla";

describe("ops case SLA", () => {
  const now = new Date("2024-01-01T01:00:00.000Z");
  const createdAt = "2024-01-01T00:00:00.000Z";

  it("computes SLA for P0", () => {
    const sla = computeCaseSla({ priority: "p0", createdAt, now });
    expect(sla?.dueAt).toBe("2024-01-01T00:15:00.000Z");
    expect(sla?.breached).toBe(true);
  });

  it("computes SLA for P1", () => {
    const sla = computeCaseSla({ priority: "p1", createdAt, now });
    expect(sla?.dueAt).toBe("2024-01-01T01:00:00.000Z");
    expect(sla?.breached).toBe(false);
  });

  it("computes SLA for P2", () => {
    const sla = computeCaseSla({ priority: "p2", createdAt, now });
    expect(sla?.dueAt).toBe("2024-01-01T04:00:00.000Z");
    expect(sla?.breached).toBe(false);
  });

  it("computes SLA for P3", () => {
    const sla = computeCaseSla({ priority: "p3", createdAt, now });
    expect(sla?.dueAt).toBe("2024-01-02T00:00:00.000Z");
    expect(sla?.breached).toBe(false);
  });
});
