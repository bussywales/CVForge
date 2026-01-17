export type CreditPack = {
  key: "starter" | "pro" | "power";
  name: string;
  priceGbp: number;
  credits: number;
  badge?: string;
  description: string;
};

export const CREDIT_PACKS: CreditPack[] = [
  {
    key: "starter",
    name: "Starter",
    priceGbp: 9,
    credits: 10,
    description: "For quick submissions and small tests.",
  },
  {
    key: "pro",
    name: "Pro",
    priceGbp: 19,
    credits: 30,
    badge: "Best value",
    description: "For active searches with multiple roles.",
  },
  {
    key: "power",
    name: "Power",
    priceGbp: 39,
    credits: 80,
    description: "For heavy usage and batch applications.",
  },
];

export function getPackByKey(key?: string | null): CreditPack | null {
  if (!key) return null;
  return CREDIT_PACKS.find((pack) => pack.key === key) ?? null;
}

export function formatGbp(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
  }).format(value);
}
