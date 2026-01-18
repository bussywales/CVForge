export type OutreachInsight = {
  sent: number;
  replies: number;
  followups: number;
  replyRate: number;
  tip: string;
};

type Activity = { type?: string | null; occurred_at?: string | null };

export function computeOutreachInsight(activities: Activity[]): OutreachInsight {
  const sent = activities.filter((a) => {
    const type = a.type ?? "";
    return type === "outreach" || type === "outreach.sent" || type === "outreach.logged";
  }).length;
  const followups = activities.filter((a) => (a.type ?? "").startsWith("followup")).length;
  const replies = activities.filter((a) => (a.type ?? "").startsWith("outreach.triage")).length;
  const replyRate = sent === 0 ? 0 : Math.round((replies / sent) * 100);

  let tip = "Send the next follow-up to keep momentum.";
  if (sent === 0) {
    tip = "Send your first outreach to start the loop.";
  } else if (replyRate < 20 && followups < sent / 2) {
    tip = "Add a clear ask and schedule a follow-up.";
  } else if (replyRate < 20) {
    tip = "Try the Direct variant with a concise ask.";
  } else if (replyRate >= 40) {
    tip = "Great reply rate — keep your cadence steady.";
  }

  return {
    sent,
    replies,
    followups,
    replyRate,
    tip,
  };
}
