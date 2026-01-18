export const ERROR_COPY = {
  referenceLabel: "Reference",
  supportSnippetLabel: "Support snippet",
  copyLabel: "Copy",
  copyReferenceLabel: "Copy reference",
  retryLabel: "Try again",
  dismissLabel: "Dismiss",
  helpLabel: "Get help",

  generic: {
    title: "Something didn’t load",
    message: "Please try again. If this keeps happening, share the reference with support.",
  },

  checkoutStart: {
    title: "Checkout couldn’t start",
    message: "No payment was taken. Please try again.",
    hint: "If it keeps failing, refresh and try once more.",
  },

  checkoutCancelled: {
    title: "Checkout cancelled",
    message: "No worries — you can pick up where you left off.",
  },

  portalOpen: {
    title: "We couldn’t open Stripe",
    message: "Please try again. If it still doesn’t open, your subscription is safe — we can help you from the reference.",
  },

  contactSave: {
    title: "Couldn’t save contact",
    message: "Your draft is still here. Try again to save the contact details.",
  },

  outcomeSave: {
    title: "Couldn’t log that outcome",
    message: "Nothing was lost. Try again — it only takes a second.",
  },

  redirectBlocked: {
    title: "Resume didn’t open",
    message: "Use Resume now to continue, or open it from your Applications queue.",
  },

  unavailable: {
    inlineLabel: "Unavailable right now",
    inlineHelp: "Please try again later or choose another option.",
  },
} as const;
