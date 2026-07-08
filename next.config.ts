import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    domains: [
      'cdn.discordapp.com',
      'avatars.githubusercontent.com',
      'lh3.googleusercontent.com',
      'lh4.googleusercontent.com',
      'lh5.googleusercontent.com',
      'lh6.googleusercontent.com',
    ],
  },
  allowedDevOrigins: ['192.168.1.101'],
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
