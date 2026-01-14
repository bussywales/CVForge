export type ApplicationDetailTabKey =
  | "overview"
  | "apply"
  | "evidence"
  | "interview"
  | "activity"
  | "admin";

const TAB_ORDER: ApplicationDetailTabKey[] = [
  "overview",
  "apply",
  "evidence",
  "interview",
  "activity",
  "admin",
];

const TAB_LABELS: Record<ApplicationDetailTabKey, string> = {
  overview: "Overview",
  apply: "Apply",
  evidence: "Evidence",
  interview: "Interview",
  activity: "Activity",
  admin: "Admin/Debug",
};

export const APPLICATION_DETAIL_TABS = TAB_ORDER.map((key) => ({
  key,
  label: TAB_LABELS[key],
}));

export function parseTab(value?: string | null) {
  if (!value) {
    return "overview";
  }
  const normalized = value.toLowerCase();
  if (TAB_ORDER.includes(normalized as ApplicationDetailTabKey)) {
    return normalized as ApplicationDetailTabKey;
  }
  return "overview";
}
