import { NextResponse } from "next/server";
import { getSupabaseUser } from "@/lib/data/supabase";
import { fetchBillingSettings } from "@/lib/data/billing";
import { getStripeClient } from "@/lib/stripe/stripe";
import { logMonetisationEvent } from "@/lib/monetisation";
import { captureServerError } from "@/lib/observability/sentry";
import { withRequestIdHeaders, jsonError } from "@/lib/observability/request-id";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { headers, requestId } = withRequestIdHeaders(request.headers);
  const { supabase, user } = await getSupabaseUser();

  if (!user) {
    return jsonError({ code: "UNAUTHORIZED", message: "Unauthorized", requestId, status: 401 });
  }

  const url = new URL(request.url);
  const settings = await fetchBillingSettings(supabase, user.id);
  const customerId = settings?.stripe_customer_id;
  if (!customerId) {
    try {
      await logMonetisationEvent(supabase, user.id, "billing_portal_error", {
        meta: { flow: url.searchParams.get("flow") ?? "manage", requestId },
        surface: "portal",
        applicationId: null,
      });
    } catch {
      /* ignore */
    }
    return jsonError({ code: "NO_STRIPE_CUSTOMER", message: "No Stripe customer", requestId, status: 400 });
  }

  const flow = url.searchParams.get("flow") ?? "manage";
  const returnTo = url.searchParams.get("returnTo") ?? "/app/billing";
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const returnUrl = returnTo.startsWith("http") ? returnTo : `${siteUrl}${returnTo}`;
  const parsedReturn = new URL(returnUrl);
  parsedReturn.searchParams.set("portal", "1");
  if (url.searchParams.get("from")) parsedReturn.searchParams.set("from", url.searchParams.get("from") as string);
  if (url.searchParams.get("support")) parsedReturn.searchParams.set("support", url.searchParams.get("support") as string);
  if (url.searchParams.get("plan")) parsedReturn.searchParams.set("plan", url.searchParams.get("plan") as string);
  if (url.searchParams.get("flow")) parsedReturn.searchParams.set("flow", url.searchParams.get("flow") as string);

  try {
    await logMonetisationEvent(supabase, user.id, "billing_portal_click", {
      meta: { flow, requestId },
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
          meta: { flow, requestId },
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
      return jsonError({ code: "PORTAL_SESSION_MISSING", message: "Unable to open portal", requestId });
    }

    try {
      await logMonetisationEvent(supabase, user.id, "billing_portal_redirected", {
        meta: { flow, requestId },
        surface: "portal",
        applicationId: null,
      });
    } catch {
      /* ignore */
    }

    const responseHeaders = new Headers(headers as any);
    responseHeaders.set("location", session.url);
    return NextResponse.redirect(session.url, { status: 303, headers: responseHeaders });
  } catch (error) {
    try {
      await logMonetisationEvent(supabase, user.id, "billing_portal_error", {
        meta: { flow, requestId },
        surface: "portal",
        applicationId: null,
      });
    } catch {
      /* ignore */
    }
    captureServerError(error, { route: "/api/billing/portal", userId: user.id, code: "PORTAL_ERROR", requestId });
    return jsonError({ code: "PORTAL_ERROR", message: "Unable to open portal", requestId });
  }
}
