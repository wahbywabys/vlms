import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ['pg'],
  // Self-contained server for the Docker image (app/Dockerfile).
  output: 'standalone',
};

export default config;
