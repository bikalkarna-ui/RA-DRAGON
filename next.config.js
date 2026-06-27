/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  typescript: {
    // Allow production builds even if there are type errors
    ignoreBuildErrors: true,
  },
  eslint: {
    // Allow production builds even if there are ESLint errors
    ignoreDuringBuilds: true,
  },
};
