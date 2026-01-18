export type FollowupItem = {
  id: string;
  role: string;
  company: string;
  dueAt?: string | null;
  dueLabel: "Overdue" | "Due today";
  isRecovery: boolean;
  channel: "gmail" | "linkedin" | "copy";
  contactEmail?: string | null;
  contactLinkedin?: string | null;
  href: string;
};

type AppLike = {
  id: string;
  job_title?: string | null;
  company?: string | null;
  company_name?: string | null;
  next_action_due?: string | null;
  outreach_next_due_at?: string | null;
  contact_email?: string | null;
  contact_linkedin?: string | null;
};

export function buildFollowupItems(apps: AppLike[], now = new Date()): FollowupItem[] {
  const today = startOfDay(now).getTime();
  const items = apps
    .map((app) => {
      const dueStr = app.outreach_next_due_at ?? app.next_action_due ?? null;
      if (!dueStr) return null;
      const due = new Date(dueStr);
      if (Number.isNaN(due.getTime())) return null;
      const dueDay = startOfDay(due).getTime();
      if (dueDay > today) return null;
      const diffDays = Math.floor((today - dueDay) / (1000 * 60 * 60 * 24));
      const isRecovery = diffDays >= 3;
      const dueLabel = diffDays > 0 ? "Overdue" : "Due today";
      const channel = app.contact_email
        ? "gmail"
        : app.contact_linkedin
          ? "linkedin"
          : "copy";
      return {
        id: app.id,
        role: app.job_title ?? "Role",
        company: app.company_name ?? app.company ?? "Company",
        dueAt: dueStr,
        dueLabel,
        isRecovery,
        channel,
        contactEmail: app.contact_email ?? null,
        contactLinkedin: app.contact_linkedin ?? null,
        href: `/app/applications/${app.id}?tab=activity#outreach`,
        urgency: diffDays,
      };
    })
    .filter(Boolean) as Array<FollowupItem & { urgency: number }>;

  items.sort((a, b) => {
    if (a.urgency !== b.urgency) return b.urgency - a.urgency;
    return (a.dueAt ?? "").localeCompare(b.dueAt ?? "");
  });

  return items.slice(0, 7).map(({ urgency, ...rest }) => rest);
}

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}
