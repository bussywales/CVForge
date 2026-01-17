import "server-only";

import { resolvePriceIdForPack } from "./packs";
import { resolvePriceIdForPlan } from "./plans";

export function getPackAvailability() {
  return {
    starter: Boolean(resolvePriceIdForPack("starter")),
    pro: Boolean(resolvePriceIdForPack("pro")),
    power: Boolean(resolvePriceIdForPack("power")),
  };
}

export function getPlanAvailability() {
  return {
    monthly_30: Boolean(resolvePriceIdForPlan("monthly_30")),
    monthly_80: Boolean(resolvePriceIdForPlan("monthly_80")),
  };
}
