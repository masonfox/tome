import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    // Skip pre-rendering for pages that fail
    workerThreads: false,
    cpus: 1,
    // Enable optimized package imports for better tree-shaking
    optimizePackageImports: ['lucide-react', 'date-fns'],
  },
  images: {
    unoptimized: true, // Required for local file system images
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },
  webpack: (config, { isServer, dev }) => {
    if (isServer) {
      // Externalize bun:sqlite and better-sqlite3 so webpack doesn't try to bundle them
      // These are loaded dynamically at runtime based on the environment
      config.externals = config.externals || [];
      config.externals.push('bun:sqlite');
      config.externals.push('better-sqlite3');
    }
    
    // Enable better tree-shaking in production
    if (!dev) {
      config.optimization = {
        ...config.optimization,
        usedExports: true,
        sideEffects: false,
      };
    }
    
    return config;
  },
};

export default nextConfig;
