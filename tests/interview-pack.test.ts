import { describe, expect, it } from "vitest";
import { calculateRoleFit } from "@/lib/role-fit";
import { buildInterviewLift } from "@/lib/interview-lift";
import { buildInterviewPack } from "@/lib/interview-pack";
import { buildInterviewPackFilename } from "@/lib/export/filename";

function normalise(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

describe("buildInterviewPack", () => {
  it("returns 10-15 questions and includes a gap-driven prompt", () => {
    const jobDescription = `
Responsibilities:
- Manage CAB and change control approvals.
- Lead incident response and reduce MTTR.
- Tune SIEM detection rules in Splunk.
- Improve vulnerability management and patch SLAs.
- Strengthen network segmentation and firewall governance.
`;
    const evidence = "SIEM rule tuning with Splunk";
    const roleFit = calculateRoleFit(jobDescription, evidence);
    const interviewLift = buildInterviewLift({
      roleFit,
      jobDescription,
      evidence,
      cvText: "",
      coverLetter: "",
      nextActionDue: null,
      lastLiftAction: null,
    });
    const pack = buildInterviewPack({
      jobTitle: "Network Security Lead",
      company: "NHS Digital",
      jobDescription,
      roleFit,
      interviewLift,
    });

    expect(pack.questions.length).toBeGreaterThanOrEqual(10);
    expect(pack.questions.length).toBeLessThanOrEqual(15);
    expect(pack.questions.some((question) => question.priority === "high")).toBe(
      true
    );

    const unique = new Set(pack.questions.map((question) => normalise(question.question)));
    expect(unique.size).toBe(pack.questions.length);
  });
});

describe("buildInterviewPackFilename", () => {
  it("builds a slugged filename with variant and length cap", () => {
    const filename = buildInterviewPackFilename({
      name: "Busayo Adewale",
      role: "Network TDA Manager",
      company: "NHS Digital",
      variant: "ats_minimal",
    });

    expect(filename.endsWith(".docx")).toBe(true);
    expect(filename.includes("Interview-Pack")).toBe(true);
    expect(filename.includes("ATS-Minimal")).toBe(true);
    expect(filename.length).toBeLessThanOrEqual(80 + ".docx".length);
  });
});
