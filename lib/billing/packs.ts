import "server-only";

import { CREDIT_PACKS, getPackByKey, type CreditPack } from "./packs-data";

export { CREDIT_PACKS, getPackByKey } from "./packs-data";

export function getPackByPriceId(priceId?: string | null): CreditPack | null {
  if (!priceId) return null;
  const packEnv = getPackEnv();
  const entries = Object.entries(packEnv).filter(([, value]) => value);
  const match = entries.find(([, value]) => value === priceId);
  if (!match) return null;
  return getPackByKey(match[0]);
}

export function resolvePriceIdForPack(key: string): string | null {
  const pack = getPackByKey(key);
  if (!pack) return null;
  const packEnv = getPackEnv();
  const envKey = packEnv[pack.key];
  return envKey ?? null;
}

function getPackEnv() {
  return {
    starter:
      process.env.STRIPE_PACK_STARTER_PRICE_ID ??
      process.env.STRIPE_CREDITS_PRICE_ID ??
      null,
    pro: process.env.STRIPE_PACK_PRO_PRICE_ID ?? null,
    power: process.env.STRIPE_PACK_POWER_PRICE_ID ?? null,
  };
}
