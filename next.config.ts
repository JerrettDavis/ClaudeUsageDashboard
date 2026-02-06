import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Enable standalone output for Docker/portable deployments
  output: 'standalone',
  
  // Enable instrumentation hook for database initialization
  experimental: {
    instrumentationHook: true,
  },
};

export default nextConfig;
