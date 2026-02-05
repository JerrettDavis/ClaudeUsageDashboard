import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Enable standalone output for Docker/portable deployments
  output: 'standalone',

  // Disable telemetry
  telemetry: false,
};

export default nextConfig;
