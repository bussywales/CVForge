import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getStripeClient } from "@/lib/stripe/stripe";
import {
  CREDIT_PACKS,
  getPackByKey,
  resolvePriceIdForPack,
} from "@/lib/billing/packs";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({} as any));
  const packKey = typeof body?.packKey === "string" ? body.packKey : undefined;
  const returnTo = typeof body?.returnTo === "string" ? body.returnTo : null;
  const pack = getPackByKey(packKey) ?? CREDIT_PACKS[0];
  const priceId = resolvePriceIdForPack(pack.key);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const baseUrl = siteUrl.replace(/\/$/, "");
  const buildUrl = (target: string | null, param: string) => {
    const url =
      target && (target.startsWith("http://") || target.startsWith("https://"))
        ? new URL(target)
        : new URL(target ?? "/app/billing", baseUrl);
    url.searchParams.set(param, "1");
    return url.toString();
  };

  if (!priceId) {
    return NextResponse.json(
      { error: "Missing priceId for pack", pack: pack.key },
      { status: 400 }
    );
  }

  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: buildUrl(returnTo, "purchased"),
    cancel_url: buildUrl(returnTo, "canceled"),
    customer_email: user.email ?? undefined,
    client_reference_id: user.id,
    metadata: {
      user_id: user.id,
      pack_key: pack.key,
    },
  });

  if (!session.url) {
    return NextResponse.json(
      { error: "Unable to create checkout session" },
      { status: 500 }
    );
  }

  return NextResponse.json({ url: session.url });
}
