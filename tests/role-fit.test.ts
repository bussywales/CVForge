import { describe, expect, it } from "vitest";
import { calculateRoleFit, detectRoleFitPacks } from "../lib/role-fit";

describe("role-fit packs", () => {
  it("always includes core pack", () => {
    const packs = detectRoleFitPacks("Short JD with minimal detail.");
    const packIds = packs.map((pack) => pack.id);
    expect(packIds).toContain("core");
  });

  it("uses fallback signals for narrative JDs with no evidence", () => {
    const jd =
      "Join an NHS digital team to improve patient pathways, data quality, and clinical systems. " +
      "You will support service redesign, governance, and operational reporting across multiple sites.";
    const result = calculateRoleFit(jd, "");
    expect(result.availableCount).toBeGreaterThan(0);
    expect(result.fallbackUsed).toBe(true);
  });

  it("detects project delivery pack for PM JDs", () => {
    const jd =
      "Project manager required to run Agile Scrum sprints, manage RAID logs, " +
      "maintain RACI ownership, and follow PRINCE2 governance across the programme.";
    const result = calculateRoleFit(jd, "");
    const packIds = result.appliedPacks.map((pack) => pack.id);
    expect(packIds).toContain("project_delivery");
  });
});
