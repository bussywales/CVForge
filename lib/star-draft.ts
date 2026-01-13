import { extractTopTerms } from "@/lib/jd-learning";

export type StarDraft = {
  requirement: string;
  question: string;
  answer: string;
};

type StarDraftInput = {
  jobDescription: string;
  achievementTitle: string;
};

export function buildStarDraft({
  jobDescription,
  achievementTitle,
}: StarDraftInput): StarDraft {
  const term = pickTopTerm(jobDescription);
  const requirement = term
    ? `Evidence for ${term}`
    : "Evidence for key role requirements";
  const question = term
    ? `Tell me about a time you delivered ${term}.`
    : "Tell me about a time you delivered on a key role requirement.";

  const context = achievementTitle.trim() || "a recent role";
  const situation = `Situation: In ${context}, there was a need to improve ${term || "the target area"}.`;
  const task = `Task: I owned the outcome, balancing quality, pace, and stakeholder expectations.`;
  const action = `Action: I prioritised the work, coordinated stakeholders, and implemented changes focused on ${term || "the requirement"}.`;
  const result = `Result: Improved outcomes in ${term || "the area"}; add the measurable impact achieved.`;

  return {
    requirement,
    question,
    answer: [situation, task, action, result].join("\n"),
  };
}

function pickTopTerm(jobDescription: string) {
  const terms = extractTopTerms(jobDescription);
  return terms[0] ?? "";
}
