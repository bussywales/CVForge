export type ActivationEventMeta = {
  stepKey?: string | null;
  ctaKey?: string | null;
  source: "dashboard";
  mode: "navigation";
  appId?: string | null;
  requestId?: string | null;
};

export function buildActivationMeta(input: {
  stepKey?: string | null;
  ctaKey?: string | null;
  appId?: string | null;
  requestId?: string | null;
}): ActivationEventMeta {
  return {
    stepKey: input.stepKey ?? null,
    ctaKey: input.ctaKey ?? null,
    source: "dashboard",
    mode: "navigation",
    appId: input.appId ?? null,
    requestId: input.requestId ?? null,
  };
}
