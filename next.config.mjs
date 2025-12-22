import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';

// Detect when running with Turbopack
const isTurbopack = Boolean(process.env.TURBOPACK);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Next 14 + Turbopack: typedRoutes not supported. Keep it when not using Turbopack.
  ...(isTurbopack ? {} : { experimental: { typedRoutes: true } }),
  // OpenNext Cloudflare will handle routing/worker generation; no need to force standalone output.
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;

// Start the OpenNext Cloudflare dev integration (spawns Wrangler, picks up proxy env vars)
initOpenNextCloudflareForDev();
