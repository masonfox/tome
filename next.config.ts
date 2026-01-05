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
  // Turbopack configuration (empty for now, may need future migration)
  turbopack: {},
  // Externalize native modules for server-side rendering
  serverExternalPackages: ['better-sqlite3', 'bun:sqlite', 'pino', 'pino-pretty'],
  webpack: (config, { isServer, dev }) => {
    if (isServer) {
      // Additional webpack externals configuration for Next.js 16
      // This ensures native modules are not bundled
      if (!config.externals) {
        config.externals = [];
      }
      
      // Handle externals as a function or array
      const externals = Array.isArray(config.externals) ? config.externals : [config.externals];
      
      // Add our native modules to externals
      externals.push(({ request }: any, callback: any) => {
        if (request === 'better-sqlite3' || request === 'bun:sqlite' || request === 'pino' || request === 'pino-pretty') {
          return callback(null, `commonjs ${request}`);
        }
        callback();
      });
      
      config.externals = externals;
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
