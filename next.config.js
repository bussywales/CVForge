/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: true,
    serverComponentsExternalPackages: ["docx", "archiver"],
  },
  env: {
    STRIPE_PACK_STARTER_PRICE_ID: process.env.STRIPE_PACK_STARTER_PRICE_ID,
    STRIPE_PACK_PRO_PRICE_ID: process.env.STRIPE_PACK_PRO_PRICE_ID,
    STRIPE_PACK_POWER_PRICE_ID: process.env.STRIPE_PACK_POWER_PRICE_ID,
    STRIPE_CREDITS_PRICE_ID: process.env.STRIPE_CREDITS_PRICE_ID,
    STRIPE_SUB_MONTHLY_30_PRICE_ID: process.env.STRIPE_SUB_MONTHLY_30_PRICE_ID,
    STRIPE_SUB_MONTHLY_80_PRICE_ID: process.env.STRIPE_SUB_MONTHLY_80_PRICE_ID,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  },
}

module.exports = nextConfig
