import { NextResponse } from "next/server";
import { resolvePriceIdForPack } from "@/lib/billing/packs";
import { resolvePriceIdForPlan } from "@/lib/billing/plans";
import { withRequestIdHeaders } from "@/lib/observability/request-id";

export async function GET() {
  const { headers, requestId } = withRequestIdHeaders();
  const hasStarter = Boolean(resolvePriceIdForPack("starter"));
  const hasPro = Boolean(resolvePriceIdForPack("pro"));
  const hasPower = Boolean(resolvePriceIdForPack("power"));
  const hasSub30 = Boolean(resolvePriceIdForPlan("monthly_30"));
  const hasSub80 = Boolean(resolvePriceIdForPlan("monthly_80"));
  const hasStripeSecret = Boolean(process.env.STRIPE_SECRET_KEY);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? null;
  const vercelEnv = process.env.NEXT_PUBLIC_VERCEL_ENV;
  const deploymentHint =
    vercelEnv === "production"
      ? "production"
      : vercelEnv === "preview"
        ? "preview"
        : "unknown";

  return NextResponse.json({
    hasStarter,
    hasPro,
    hasPower,
    hasSub30,
    hasSub80,
    hasStripeSecret,
    siteUrl,
    deploymentHint,
    requestId,
  }, { headers });
}
