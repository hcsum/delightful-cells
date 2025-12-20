/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true,
  },
  // OpenNext Cloudflare will handle routing/worker generation;
  // no need to force standalone output.
  eslint: {
    // Avoid requiring eslint installation in CI/build for this project
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
