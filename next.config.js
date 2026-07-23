/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: false,
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  experimental: { missingSuspenseWithCSRBailout: false },
  images: { unoptimized: true },
  async headers() {
    return [
      {
        // Never let the browser/CDN cache page HTML — always fetch fresh.
        // Excludes /_next/static and /api so fingerprinted JS/CSS assets
        // still cache normally for performance, and API responses set
        // their own cache behavior individually.
        source: '/((?!_next/static|_next/image|api|favicon.ico|icon-|apple-touch-icon).*)',
        headers: [
          { key: 'Cache-Control', value: 'no-store, must-revalidate' },
        ],
      },
    ];
  },
};
