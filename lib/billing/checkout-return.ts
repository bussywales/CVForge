export type CheckoutReturnStatus = "success" | "cancel" | "failed" | null;

export type CheckoutReturnMode = "subscription" | "pack" | "portal" | "unknown";

export type CheckoutReturnState = {
  status: CheckoutReturnStatus;
  mode: CheckoutReturnMode;
  resume: boolean;
  reason: string | null;
  from: string | null;
  planKey: "monthly_30" | "monthly_80" | null;
  rawStatus: string | null;
};

type InputParams =
  | URLSearchParams
  | Readonly<URLSearchParams>
  | Record<string, string | string[] | undefined>
  | null
  | undefined;

function normaliseParams(input?: InputParams): URLSearchParams {
  if (!input) return new URLSearchParams();
  if (input instanceof URLSearchParams) return input;
  const params = new URLSearchParams();
  Object.entries(input).forEach(([key, value]) => {
    if (typeof value === "undefined") return;
    if (Array.isArray(value)) {
      value.forEach((v) => params.append(key, v));
    } else {
      params.set(key, value);
    }
  });
  return params;
}

function parseStatus(params: URLSearchParams): CheckoutReturnStatus {
  if (params.get("success") === "1" || params.get("purchased") === "1" || params.get("status") === "success") {
    return "success";
  }
  if (
    params.get("cancel") === "1" ||
    params.get("canceled") === "1" ||
    params.get("cancelled") === "1" ||
    params.get("status") === "cancel"
  ) {
    return "cancel";
  }
  if (params.get("fail") === "1" || params.get("failed") === "1" || params.get("status") === "failed") {
    return "failed";
  }
  return null;
}

function parseMode(params: URLSearchParams): CheckoutReturnMode {
  const modeParam = params.get("mode");
  if (modeParam === "subscription") return "subscription";
  if (modeParam === "pack") return "pack";
  if (params.get("portal") === "1") return "portal";
  if (params.get("sub") === "1") return "subscription";
  return "unknown";
}

export function parseCheckoutReturn(params?: InputParams): CheckoutReturnState {
  const searchParams = normaliseParams(params);
  const status = parseStatus(searchParams);
  const mode = parseMode(searchParams);
  const resume = searchParams.get("resume") === "1";
  const reason = searchParams.get("reason");
  const from = searchParams.get("from");
  const plan = searchParams.get("plan");
  const planKey = plan === "monthly_30" || plan === "monthly_80" ? plan : null;

  return {
    status,
    mode,
    resume,
    reason: reason ?? null,
    from,
    planKey,
    rawStatus: searchParams.get("status"),
  };
}
