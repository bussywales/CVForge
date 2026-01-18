export type OfferSummary = {
  roleTitle?: string;
  company?: string;
  baseSalary?: number | null;
  currency?: string;
  bonus?: string;
  equity?: string;
  startDate?: string;
  location?: string;
  hybridPolicy?: string;
  noticePeriod?: string;
  benefitsNotes?: string;
  deadlineToRespond?: string;
  recruiterName?: string;
  recruiterEmail?: string;
};

export type CounterProposal = {
  targetBase?: number | null;
  upliftPct?: number | null;
  asks?: string[];
};

export type NegotiationScript = {
  key: "polite" | "direct" | "warm";
  email: string;
  linkedin: string;
  phone: string;
  reason: string;
};

export type OfferDecision = "negotiating" | "accepted" | "declined" | "asked_for_time" | null;

export function countOfferCompletion(summary: OfferSummary): { filled: number; total: number } {
  const total = 13;
  const filled = [
    summary.roleTitle,
    summary.company,
    summary.baseSalary,
    summary.currency,
    summary.bonus,
    summary.equity,
    summary.startDate,
    summary.location,
    summary.hybridPolicy,
    summary.noticePeriod,
    summary.benefitsNotes,
    summary.deadlineToRespond,
    summary.recruiterName || summary.recruiterEmail,
  ].filter((value) => {
    if (value === null || value === undefined) return false;
    if (typeof value === "number") return !Number.isNaN(value);
    return String(value).trim().length > 0;
  }).length;
  return { filled, total };
}

export function buildCounterSummary(summary: OfferSummary, counter: CounterProposal) {
  const base = summary.baseSalary ?? 0;
  const upliftPct = counter.upliftPct ?? null;
  const targetBase =
    counter.targetBase && counter.targetBase > 0
      ? counter.targetBase
      : upliftPct && base
        ? Math.round(base * (1 + upliftPct / 100))
        : null;
  const upliftAmount = targetBase && base ? targetBase - base : null;
  const asks = counter.asks ?? [];
  const askSummary =
    asks.length > 0
      ? `Also asking for ${asks.join(", ")}.`
      : "Open to flexible start and hybrid balance.";

  return {
    targetBase,
    upliftAmount,
    upliftPct: upliftPct ?? (upliftAmount && base ? Math.round((upliftAmount / base) * 100) : null),
    askSummary,
  };
}

export function buildNegotiationScripts(summary: OfferSummary, counter: CounterProposal): NegotiationScript[] {
  const currency = summary.currency || "GBP";
  const counterData = buildCounterSummary(summary, counter);
  const baseLine = summary.baseSalary
    ? `Thank you for the offer of ${currency} ${summary.baseSalary.toLocaleString()}.`
    : "Thank you for sharing the offer details.";
  const counterLine = counterData.targetBase
    ? `Based on scope and market, I was hoping for ${currency} ${counterData.targetBase.toLocaleString()} (approx. ${counterData.upliftPct ?? "—"}% uplift).`
    : "Could we revisit base and bonus to match the role scope?";
  const askLine = counterData.askSummary;
  const closing =
    summary.deadlineToRespond && summary.deadlineToRespond.trim()
      ? `If timing is tight, I can confirm by ${summary.deadlineToRespond}.`
      : "Happy to confirm quickly once we align.";

  const polite: NegotiationScript = {
    key: "polite",
    email: [
      `Hi ${summary.recruiterName || "there"},`,
      "",
      baseLine,
      counterLine,
      askLine,
      closing,
      "",
      "Thanks for working through this with me.",
      "",
    ].join("\n"),
    linkedin: [
      baseLine,
      counterData.targetBase ? `Could we align closer to ${currency} ${counterData.targetBase.toLocaleString()}?` : "Could we revisit base/bonus?",
      closing,
    ].join(" "),
    phone: `Thank them, confirm role fit, state target (${counterData.targetBase ? `${currency} ${counterData.targetBase.toLocaleString()}` : "align base/bonus"}), mention asks (${askLine}), and propose next check-in.`,
    reason: "Polite ask with gratitude and clarity.",
  };

  const direct: NegotiationScript = {
    key: "direct",
    email: [
      `Hi ${summary.recruiterName || "team"},`,
      "",
      baseLine,
      counterData.targetBase
        ? `I’d like to move forward at ${currency} ${counterData.targetBase.toLocaleString()} base.`
        : "To accept, I need clarity on base and bonus.",
      askLine,
      closing,
      "",
      "If we can align here, I’ll confirm immediately.",
      "",
    ].join("\n"),
    linkedin: [
      baseLine,
      counterData.targetBase ? `I can accept at ${currency} ${counterData.targetBase.toLocaleString()}.` : "Need to confirm base/bonus to proceed.",
      "Can we align today?",
    ].join(" "),
    phone: `Lead with excitement, state floor (${counterData.targetBase ? `${currency} ${counterData.targetBase.toLocaleString()}` : "need base clarity"}), confirm asks (${askLine}), and propose agreement on this call.`,
    reason: "Direct target with quick-close intent.",
  };

  const warm: NegotiationScript = {
    key: "warm",
    email: [
      `Hi ${summary.recruiterName || "there"},`,
      "",
      `Appreciate the offer for ${summary.roleTitle ?? "the role"} at ${summary.company ?? "the team"}.`,
      baseLine,
      counterLine,
      askLine,
      closing,
      "",
      "Looking forward to making this work together.",
      "",
    ].join("\n"),
    linkedin: [
      `Thanks for the offer on ${summary.roleTitle ?? "the role"}.`,
      counterData.targetBase
        ? `Would ${currency} ${counterData.targetBase.toLocaleString()} base work?`
        : "Could we discuss base/bonus details?",
      askLine,
    ].join(" "),
    phone: `Warm intro, reiterate excitement, share target (${counterData.targetBase ? `${currency} ${counterData.targetBase.toLocaleString()}` : "align compensation"}), mention key asks (${askLine}), and suggest a quick align.`,
    reason: "Warm tone with clarity on target and asks.",
  };

  return [polite, direct, warm];
}

export function mapDecisionToOutcome(decision: OfferDecision) {
  switch (decision) {
    case "accepted":
      return { status: "offer", reason: "accepted" };
    case "declined":
      return { status: "rejected", reason: "declined_offer" };
    case "asked_for_time":
      return { status: "offer", reason: "asked_for_time" };
    case "negotiating":
    default:
      return { status: "offer", reason: "negotiating" };
  }
}
