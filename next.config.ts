import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Enable standalone output for Docker/portable deployments
  output: 'standalone',
};

export default nextConfig;
