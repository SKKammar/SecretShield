import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Enable React strict mode for better development experience
  reactStrictMode: true,

  // Allow images from GitHub avatars and assets
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'github.com',
      },
    ],
  },

  // Environment variables available at build time
  env: {
    NEXT_PUBLIC_APP_VERSION: '1.0.0',
  },
};

export default nextConfig;
