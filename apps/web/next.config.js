/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@ally/sdk'],
  experimental: {
    appDir: true,
  },
};

module.exports = nextConfig;
