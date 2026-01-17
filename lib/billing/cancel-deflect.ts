export type CancelReasonKey = "expensive" | "low_usage" | "alternative" | "unsure" | "technical";

export type CancelDeflectOffer =
  | "downgrade"
  | "pause"
  | "finish_week"
  | "keep";

export type CancelDeflectReco = {
  offerKey: CancelDeflectOffer;
  flow: string;
  planTarget?: "monthly_30" | "monthly_80";
  label: string;
};

export function recommendCancelDeflect(input: {
  planKey: "monthly_30" | "monthly_80";
  reason: CancelReasonKey;
}): CancelDeflectReco {
  const { planKey, reason } = input;

  if (planKey === "monthly_80" && (reason === "expensive" || reason === "low_usage" || reason === "unsure")) {
    return {
      offerKey: "downgrade",
      flow: "cancel_deflect",
      planTarget: "monthly_30",
      label: "Switch to Monthly 30",
    };
  }

  if (reason === "low_usage" || reason === "unsure" || reason === "technical") {
    return {
      offerKey: "pause",
      flow: "cancel_deflect_pause",
      planTarget: planKey,
      label: "See pause options",
    };
  }

  if (reason === "alternative") {
    return {
      offerKey: "finish_week",
      flow: "cancel_deflect",
      planTarget: planKey,
      label: "Finish this week then cancel",
    };
  }

  return {
    offerKey: "keep",
    flow: "cancel_deflect",
    planTarget: planKey,
    label: planKey === "monthly_80" ? "Switch to Monthly 30" : "Keep plan",
  };
}
