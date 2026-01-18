export const BILLING_MICROCOPY = Object.freeze({
  cancelDeflection: {
    title: "Before you go…",
    subtitle: "Pick one thing — we’ll tailor the best option to keep your momentum.",
    reasonTitle: "What’s driving this decision?",
    reasonHelper: "This takes 5 seconds.",
    stepTitle: "Best option for you",
    stepSubtitle: "Based on your plan and recent activity.",
    primaryCtaTemplate: "Keep going with {offerLabel}",
    secondaryCta: "Continue to Stripe",
    tertiaryCta: "Not now",
    downgradeLabel: "Monthly 30",
    pauseLabel: "Manage subscription",
    stayLabel: "Stay on my plan",
    downgradeDesc: "Lower cost, same weekly structure — you keep your streak.",
    pauseDesc: "Take a break without losing your setup. You can resume anytime.",
    stayDesc: "Keep your weekly coach, streak saver, and completion nudges.",
    trust: "You can still cancel in Stripe. This just shows the best alternative first.",
    savedToast: "Updated — you’re all set.",
    bypassToast: "Opening Stripe…",
    errorBanner: "Couldn’t open Stripe right now. Please try again.",
    retryButton: "Try again",
    dismissCopy: "We won’t show this again this week.",
  },
} as const);

export function formatCta(template: string, vars: Record<string, string>) {
  return template.replace(/{(\w+)}/g, (_, key) => vars[key] ?? "");
}
