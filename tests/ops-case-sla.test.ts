import { describe, expect, it } from "vitest";
import { computeCaseSla, formatCaseSlaLabel } from "@/lib/ops/ops-case-sla";

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

  it("uses dueAt when provided", () => {
    const sla = computeCaseSla({
      priority: "p2",
      createdAt,
      dueAt: "2024-01-01T02:00:00.000Z",
      now,
    });
    expect(sla?.dueAt).toBe("2024-01-01T02:00:00.000Z");
  });

  it("formats breached SLA with non-zero minutes", () => {
    const label = formatCaseSlaLabel({ remainingMs: 90_000, breached: true });
    expect(label).toBe("SLA breached by: 2m");
  });

  it("formats breached SLA under 60s as 0m", () => {
    const label = formatCaseSlaLabel({ remainingMs: 45_000, breached: true });
    expect(label).toBe("SLA breached by: 0m");
  });

  it("formats paused SLA label", () => {
    const label = formatCaseSlaLabel({ remainingMs: 3_600_000, breached: false, paused: true });
    expect(label).toContain("paused (waiting)");
  });
});
