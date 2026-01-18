const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

type SupportLinkKind =
  | "billing_compare"
  | "billing_subscription_30"
  | "billing_subscription_80"
  | "billing_topup_starter"
  | "billing_topup_pro"
  | "billing_topup_power"
  | "application";

export function buildSupportLink(params: {
  kind: SupportLinkKind;
  userId: string;
  applicationId?: string;
  tab?: string | null;
  anchor?: string | null;
}) {
  const baseParams = new URLSearchParams({ from: "ops_support", support: "1" });
  let path = "/login";

  switch (params.kind) {
    case "billing_compare":
      path = "/app/billing?from=ops_support&support=1";
      break;
    case "billing_subscription_30":
      path = `/app/billing?from=ops_support&support=1&plan=monthly_30`;
      break;
    case "billing_subscription_80":
      path = `/app/billing?from=ops_support&support=1&plan=monthly_80`;
      break;
    case "billing_topup_starter":
      path = `/app/billing?from=ops_support&support=1&pack=starter`;
      break;
    case "billing_topup_pro":
      path = `/app/billing?from=ops_support&support=1&pack=pro`;
      break;
    case "billing_topup_power":
      path = `/app/billing?from=ops_support&support=1&pack=power`;
      break;
    case "application": {
      const tab = params.tab ? `?tab=${params.tab}` : "";
      const anchor = params.anchor ? `#${params.anchor}` : "";
      if (!params.applicationId) {
        throw new Error("applicationId required for application link");
      }
      path = `/app/applications/${params.applicationId}${tab}${anchor}`;
      if (path.includes("?")) {
        path += "&from=ops_support&support=1";
      } else {
        path += "?from=ops_support&support=1";
      }
      break;
    }
    default:
      path = "/login";
  }

  const url = path.startsWith("http") ? path : `${SITE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
  // ensure baseParams for login-only paths
  if (!url.includes("from=ops_support")) {
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}${baseParams.toString()}`;
  }
  return url;
}

export type { SupportLinkKind };
