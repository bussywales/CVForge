import { formatDateUk } from "@/lib/tracking-utils";

export type FollowupTemplate = {
  id: string;
  label: string;
  subject: string;
  body: string;
};

type TemplateInput = {
  contactName?: string | null;
  companyName?: string | null;
  jobTitle?: string | null;
  appliedAt?: string | null;
  jobUrl?: string | null;
  fullName?: string | null;
};

export function buildFollowupTemplates(input: TemplateInput): FollowupTemplate[] {
  const contactName = input.contactName?.trim();
  const companyName = input.companyName?.trim();
  const jobTitle = input.jobTitle?.trim() || "the role";
  const appliedDate = input.appliedAt ? formatDateUk(input.appliedAt) : "";
  const jobHost = input.jobUrl ? safeHost(input.jobUrl) : "";
  const fullName = input.fullName?.trim();

  const greeting = contactName ? `Hi ${contactName},` : "Hello,";
  const signature = fullName ? `\n\nKind regards,\n${fullName}` : "\n\nKind regards,";
  const companyLabel = companyName ? ` at ${companyName}` : "";
  const appliedLabel = appliedDate ? ` on ${appliedDate}` : "";
  const sourceLabel = jobHost ? ` via ${jobHost}` : "";

  const applySubject = companyName
    ? `Follow-up on ${jobTitle} application – ${companyName}`
    : `Follow-up on ${jobTitle} application`;

  const applyBody =
    `${greeting}\n\n` +
    `I hope you're well. I applied for the ${jobTitle} role${companyLabel}${appliedLabel}${sourceLabel}. ` +
    "I'm keen to reiterate my interest and would appreciate any update on next steps. " +
    "I'm happy to provide any additional details if helpful." +
    signature;

  const interviewSubject = companyName
    ? `Thank you – ${jobTitle} interview at ${companyName}`
    : `Thank you – ${jobTitle} interview`;

  const interviewBody =
    `${greeting}\n\n` +
    `Thank you for the conversation about the ${jobTitle} role${companyLabel}. ` +
    "I enjoyed learning more about the team and the priorities ahead. " +
    "Please let me know if there is anything else I can provide to support the process." +
    signature;

  const warmSubject = companyName
    ? `Checking in on ${jobTitle} – ${companyName}`
    : `Checking in on ${jobTitle}`;

  const warmBody =
    `${greeting}\n\n` +
    `I wanted to keep in touch regarding the ${jobTitle} role${companyLabel}. ` +
    "I'm still very interested and would welcome any updates on timing or next steps." +
    signature;

  return [
    {
      id: "post-apply",
      label: "Follow-up after applying",
      subject: applySubject,
      body: applyBody,
    },
    {
      id: "post-interview",
      label: "Follow-up after interview",
      subject: interviewSubject,
      body: interviewBody,
    },
    {
      id: "reconnect",
      label: "Reconnect / keep-warm",
      subject: warmSubject,
      body: warmBody,
    },
  ];
}

export function buildLinkedInTemplate(input: TemplateInput): FollowupTemplate {
  const contactName = input.contactName?.trim();
  const companyName = input.companyName?.trim();
  const jobTitle = input.jobTitle?.trim() || "the role";

  const greeting = contactName ? `Hi ${contactName},` : "Hi there,";
  const companyLabel = companyName ? ` at ${companyName}` : "";

  const body =
    `${greeting}\n\n` +
    `I applied for ${jobTitle}${companyLabel} and wanted to introduce myself. ` +
    "If you're the right contact, I'd appreciate any update on next steps. " +
    "Happy to share more detail if helpful.\n\n" +
    "Thanks!";

  return {
    id: "linkedin-dm",
    label: "LinkedIn DM",
    subject: "LinkedIn DM",
    body,
  };
}

function safeHost(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.host;
  } catch {
    return "";
  }
}
