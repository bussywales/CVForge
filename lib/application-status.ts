export const applicationStatusValues = [
  "draft",
  "ready",
  "applied",
  "interviewing",
  "offer",
  "rejected",
  "on_hold",
] as const;

export type ApplicationStatusValue = (typeof applicationStatusValues)[number];

export const applicationStatusOptions = [
  { value: "draft", label: "Draft" },
  { value: "ready", label: "Ready" },
  { value: "applied", label: "Applied" },
  { value: "interviewing", label: "Interviewing" },
  { value: "offer", label: "Offer" },
  { value: "rejected", label: "Rejected" },
  { value: "on_hold", label: "On hold" },
] as const;

export const applicationStatusLabels = applicationStatusOptions.reduce(
  (acc, option) => {
    acc[option.value] = option.label;
    return acc;
  },
  {} as Record<ApplicationStatusValue, string>
);

export function normaliseApplicationStatus(value: string | null | undefined) {
  if (!value) {
    return "draft" as ApplicationStatusValue;
  }
  if (value === "interview") {
    return "interviewing";
  }
  if (applicationStatusValues.includes(value as ApplicationStatusValue)) {
    return value as ApplicationStatusValue;
  }
  return "draft" as ApplicationStatusValue;
}
