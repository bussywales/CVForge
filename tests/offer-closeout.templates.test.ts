import { describe, expect, it } from "vitest";
import { buildWithdrawalTemplates, buildCloseoutList } from "@/lib/offer-closeout";

describe("offer closeout templates", () => {
  it("includes company and role in templates", () => {
    const templates = buildWithdrawalTemplates({
      role: "Engineer",
      company: "Acme",
      contactName: "Alex",
    });
    expect(templates.warm.body).toContain("Acme");
    expect(templates.direct.subject).toContain("Engineer");
  });

  it("filters out accepted app", () => {
    const list = buildCloseoutList(
      [
        { id: "a1", role: "R1", company: "X", status: "submitted" },
        { id: "a2", role: "R2", company: "Y", status: "offer" },
      ] as any,
      "a2"
    );
    expect(list.find((item) => item.id === "a2")).toBeUndefined();
    expect(list.length).toBe(1);
  });
});
