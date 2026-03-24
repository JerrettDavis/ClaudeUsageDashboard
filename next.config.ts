import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Enable standalone output for Docker/portable deployments
  output: 'standalone',
  // Exclude non-app files from the NFT (Node File Tracing) output.
  // These files end up in the trace when dynamic fs paths (e.g. path.resolve
  // with process.cwd()) are evaluated at build time and accidentally span the
  // project root. This exclusion list tells Next.js to drop them from the
  // standalone bundle even if the tracer collected them.
  outputFileTracingExcludes: {
    '**/*': [
      '**/scripts/**',
      '**/tests/**',
      '**/CHANGELOG.md',
      '**/CONTRIBUTING.md',
      '**/README.md',
      '**/SCREENSHOTS.md',
      '**/TROUBLESHOOTING.md',
      '**/eslint.config.mjs',
      '**/biome.json',
      '**/drizzle.config.ts',
      '**/playwright.config.ts.disabled',
      '**/vitest.config.ts',
      '**/tailwind.config.js',
      '**/tsconfig.json',
      '**/postcss.config.mjs',
      '**/src-tauri/**',
      '**/public/**',
    ],
  },
};

export default nextConfig;
