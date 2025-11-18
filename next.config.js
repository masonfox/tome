/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    instrumentationHook: true,
  },
  images: {
    unoptimized: true, // Required for local file system images
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Externalize bun:sqlite and better-sqlite3 so webpack doesn't try to bundle them
      // These are loaded dynamically at runtime based on the environment
      config.externals = config.externals || [];
      config.externals.push('bun:sqlite');
      config.externals.push('better-sqlite3');
    }
    return config;
  },
};

module.exports = nextConfig;
