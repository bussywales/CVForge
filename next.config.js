/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: true,
    serverComponentsExternalPackages: ["docx", "archiver"],
  },
}

module.exports = nextConfig
