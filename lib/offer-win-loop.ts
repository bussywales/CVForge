type OfferishStatus =
  | "offer"
  | "offer_received"
  | "negotiating"
  | "accepted"
  | "declined"
  | "asked_for_time";

export type OfferWinCandidate = {
  applicationId: string;
  role: string;
  company: string;
  status: OfferishStatus;
  primaryHref: string;
  steps: Array<{ key: string; label: string; href: string }>;
};

type AppLike = {
  id: string;
  job_title?: string | null;
  company?: string | null;
  company_name?: string | null;
  last_outcome_status?: string | null;
  last_outcome_at?: string | null;
  outcome_status?: string | null;
  outcome_at?: string | null;
};

const OFFER_STATUSES: OfferishStatus[] = [
  "offer",
  "offer_received",
  "negotiating",
  "asked_for_time",
  "accepted",
  "declined",
];

export function getOfferWinCandidate(apps: AppLike[], now = new Date()): OfferWinCandidate | null {
  const eligible = apps
    .map((app) => {
      const status =
        (app.last_outcome_status ?? app.outcome_status ?? "").toLowerCase() as OfferishStatus;
      if (!OFFER_STATUSES.includes(status)) return null;
      const ts =
        (app.last_outcome_at && Date.parse(app.last_outcome_at)) ||
        (app.outcome_at && Date.parse(app.outcome_at)) ||
        0;
      return { app, status, ts };
    })
    .filter(Boolean) as Array<{ app: AppLike; status: OfferishStatus; ts: number }>;

  if (!eligible.length) return null;

  eligible.sort((a, b) => b.ts - a.ts);
  const pick = eligible[0];
  const applicationId = pick.app.id;
  const role = pick.app.job_title || "Role";
  const company = pick.app.company_name || pick.app.company || "Company";
  const primaryHref = `/app/applications/${applicationId}?tab=overview#offer-pack`;

  return {
    applicationId,
    role,
    company,
    status: pick.status,
    primaryHref,
    steps: buildOfferWinSteps(applicationId),
  };
}

export function buildOfferWinSteps(applicationId: string) {
  return [
    {
      key: "offer-summary",
      label: "Review offer summary",
      href: `/app/applications/${applicationId}?tab=overview#offer-pack`,
    },
    {
      key: "offer-counter",
      label: "Draft counter / script",
      href: `/app/applications/${applicationId}?tab=overview#offer-pack`,
    },
    {
      key: "offer-send",
      label: "Send message",
      href: `/app/applications/${applicationId}?tab=activity#outreach`,
    },
    {
      key: "offer-log",
      label: "Log response / decision",
      href: `/app/applications/${applicationId}?tab=overview#outcome`,
    },
  ];
}
