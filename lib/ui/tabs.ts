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

const STORAGE_PREFIX = "cvforge.appDetailTab";

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

export function resolveInitialTab(options: {
  queryTab?: string | null;
  storedTab?: string | null;
  defaultTab?: ApplicationDetailTabKey;
}) {
  if (options.queryTab) {
    return parseTab(options.queryTab);
  }
  if (options.storedTab) {
    return parseTab(options.storedTab);
  }
  return options.defaultTab ?? "overview";
}

export function getTabStorageKey(applicationId: string) {
  return `${STORAGE_PREFIX}:${applicationId}`;
}

export type TabBadges = {
  apply?: number | null;
  evidence?: number | null;
  interview?: number | null;
  activity?: "due" | null;
};

export function computeTabBadges(input: {
  pendingApplyItems?: number;
  evidenceGaps?: number;
  interviewPriority?: number;
  hasDueAction?: boolean;
}) {
  const badges: TabBadges = {};
  if (typeof input.pendingApplyItems === "number" && input.pendingApplyItems > 0) {
    badges.apply = input.pendingApplyItems;
  }
  if (typeof input.evidenceGaps === "number" && input.evidenceGaps > 0) {
    badges.evidence = input.evidenceGaps;
  }
  if (typeof input.interviewPriority === "number" && input.interviewPriority > 0) {
    badges.interview = input.interviewPriority;
  }
  if (input.hasDueAction) {
    badges.activity = "due";
  }
  return badges;
}
