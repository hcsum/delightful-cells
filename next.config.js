/** @type {import('next').NextConfig} */
const isTurbopack = Boolean(process.env.TURBOPACK);

const nextConfig = {
  reactStrictMode: true,
  ...(isTurbopack ? {} : { typedRoutes: true }),
  // OpenNext Cloudflare will handle routing/worker generation;
  // no need to force standalone output.
  eslint: {
    // Avoid requiring eslint installation in CI/build for this project
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;

// Start the OpenNext Cloudflare dev integration (spawns Wrangler, picks up proxy env vars)
// Note: do not await; Next loads the config twice in dev; this is resilient.
try {
  // Dynamic import to avoid bundling and to work in CommonJS config.
  // eslint-disable-next-line unicorn/prefer-top-level-await
  import('@opennextjs/cloudflare')
    .then((m) => m.initOpenNextCloudflareForDev?.())
    .catch(() => {});
} catch {}
