import { NextResponse } from "next/server";
import { getSupabaseUser } from "@/lib/data/supabase";
import { fetchBillingSettings } from "@/lib/data/billing";
import { getStripeClient } from "@/lib/stripe/stripe";
import { logMonetisationEvent } from "@/lib/monetisation";
import { captureServerError } from "@/lib/observability/sentry";
import { withRequestIdHeaders } from "@/lib/observability/request-id";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { headers, requestId } = withRequestIdHeaders(request.headers);
  const url = new URL(request.url);
  const wantsJson = request.headers.get("accept")?.includes("application/json") || url.searchParams.get("format") === "json";
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const flow = url.searchParams.get("flow") ?? "manage";
  const returnTo = url.searchParams.get("returnTo") ?? "/app/billing";
  const baseHeaders = new Headers(headers as any);
  baseHeaders.set("cache-control", "private, no-store, max-age=0, must-revalidate");
  baseHeaders.set("pragma", "no-cache");
  baseHeaders.set("x-request-id", requestId ?? "");

  const errorResponse = (code: string, message: string, status = 500) => {
    if (wantsJson) {
      return NextResponse.json({ ok: false, code, requestId }, { status, headers: baseHeaders });
    }
    const redirectUrl = new URL(`${siteUrl}/app/billing`);
    redirectUrl.searchParams.set("portal_error", "1");
    if (requestId) redirectUrl.searchParams.set("req", requestId);
    if (code) redirectUrl.searchParams.set("code", code || "unknown");
    redirectUrl.searchParams.set("mode", "navigation");
    baseHeaders.set("location", redirectUrl.toString());
    return NextResponse.redirect(redirectUrl.toString(), { status: 303, headers: baseHeaders });
  };

  const { supabase, user } = await getSupabaseUser();

  if (!user) {
    return errorResponse("UNAUTHORIZED", "Unauthorized", 401);
  }

  const settings = await fetchBillingSettings(supabase, user.id);
  const customerId = settings?.stripe_customer_id;
  if (!customerId) {
    try {
      await logMonetisationEvent(supabase, user.id, "billing_portal_error", {
        meta: { flow: url.searchParams.get("flow") ?? "manage", requestId, mode: "navigation", destination: "portal", code: "NO_STRIPE_CUSTOMER" },
        surface: "portal",
        applicationId: null,
      });
    } catch {
      /* ignore */
    }
    return errorResponse("NO_STRIPE_CUSTOMER", "No Stripe customer", 400);
  }

  const returnUrl = returnTo.startsWith("http") ? returnTo : `${siteUrl}${returnTo}`;
  const parsedReturn = new URL(returnUrl);
  parsedReturn.searchParams.set("portal", "1");
  if (url.searchParams.get("from")) parsedReturn.searchParams.set("from", url.searchParams.get("from") as string);
  if (url.searchParams.get("support")) parsedReturn.searchParams.set("support", url.searchParams.get("support") as string);
  if (url.searchParams.get("plan")) parsedReturn.searchParams.set("plan", url.searchParams.get("plan") as string);
  if (url.searchParams.get("flow")) parsedReturn.searchParams.set("flow", url.searchParams.get("flow") as string);

  try {
    await logMonetisationEvent(supabase, user.id, "billing_portal_click", {
      meta: { flow, requestId, mode: "navigation", destination: "portal" },
      surface: "portal",
      applicationId: null,
    });
  } catch {
    /* ignore */
  }

  try {
    const stripe = getStripeClient();
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: parsedReturn.toString(),
    });

    if (!session.url) {
      try {
        await logMonetisationEvent(supabase, user.id, "billing_portal_error", {
          meta: { flow, requestId, mode: "navigation", destination: "portal", code: "PORTAL_SESSION_MISSING" },
          surface: "portal",
          applicationId: null,
        });
      } catch {
        /* ignore */
      }
      captureServerError(new Error("Portal session missing url"), {
        requestId,
        route: "/api/billing/portal",
        userId: user.id,
        code: "PORTAL_SESSION_MISSING",
      });
      return errorResponse("PORTAL_SESSION_MISSING", "Unable to open portal");
    }

    try {
      await logMonetisationEvent(supabase, user.id, "billing_portal_redirected", {
        meta: { flow, requestId, mode: "navigation", destination: "portal" },
        surface: "portal",
        applicationId: null,
      });
    } catch {
      /* ignore */
    }

    baseHeaders.set("location", session.url);
    return NextResponse.redirect(session.url, { status: 303, headers: baseHeaders });
  } catch (error) {
    try {
      await logMonetisationEvent(supabase, user.id, "billing_portal_error", {
        meta: { flow, requestId, mode: "navigation", destination: "portal", code: "PORTAL_ERROR" },
        surface: "portal",
        applicationId: null,
      });
    } catch {
      /* ignore */
    }
    captureServerError(error, { route: "/api/billing/portal", userId: user.id, code: "PORTAL_ERROR", requestId });
    return errorResponse("PORTAL_ERROR", "Unable to open portal");
  }
}
