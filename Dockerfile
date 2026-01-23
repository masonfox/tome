# Use Node.js LTS image
FROM node:22-alpine AS base
WORKDIR /app

# Install build dependencies for better-sqlite3 native module
# Install bash for running utility scripts (backup, restore, etc.)
# Install su-exec for PUID/PGID support (privilege dropping)
RUN apk add --no-cache python3 make g++ bash su-exec

# Install dependencies
FROM base AS deps
COPY package.json package-lock.json ./
# Install all dependencies (including devDependencies for build)
# Use --legacy-peer-deps due to eslint-config-next@16.1.1 requiring eslint@>=9.0.0
RUN npm ci --legacy-peer-deps

# Install production dependencies only
FROM base AS prod-deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --legacy-peer-deps

# Install migration dependencies (standalone build doesn't include all dependencies)
# These packages are needed by lib/db/migrate.ts and companion migrations which run before the app starts
# Note: date-fns and date-fns-tz are required by companion migrations for timezone conversions
# Note: dotenv is required by backup/restore/seed scripts for environment variable loading
FROM base AS migration-deps
RUN npm install \
  drizzle-orm@^0.44.7 \
  pino@^9.3.1 \
  tsx@^4.7.0 \
  better-sqlite3@^12.4.1 \
  date-fns@^3.3.0 \
  date-fns-tz@^3.2.0 \
  dotenv@^16.0.0

# Build the application
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set environment variable for build
ENV NEXT_TELEMETRY_DISABLED=1

# Create data directory for SQLite database
RUN mkdir -p data

RUN npm run build

# Build the entrypoint script (compile TypeScript → JavaScript)
# This resolves path aliases (@/) at build time via esbuild
# Migrations will still use tsx at runtime for companion migrations
RUN npm run build:entrypoint

# Production image
FROM base AS runner
WORKDIR /app

# Install sqlite3 CLI for debugging and su-exec for PUID/PGID support
RUN apk add --no-cache sqlite su-exec

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_PATH=/app/data/tome.db
ENV NODE_OPTIONS="--enable-source-maps"

# Create default non-root user (Alpine syntax)
# These are fallback defaults if PUID/PGID are not specified
# The entrypoint script will handle creating/modifying users at runtime
RUN addgroup -g 1001 -S nodejs
RUN adduser -u 1001 -S nextjs -G nodejs

# Create data directory (permissions will be set by entrypoint)
RUN mkdir -p data

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Create .next runtime directories that Next.js will write to at runtime
# These include cache directories and prerender cache files
# Ownership will be set by entrypoint script based on PUID/PGID
RUN mkdir -p .next/cache .next/server/app && \
    chown -R nextjs:nodejs .next

# Copy database files and migration scripts
COPY --from=builder --chown=nextjs:nodejs /app/data ./data
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle
COPY --from=builder --chown=nextjs:nodejs /app/lib ./lib
COPY --from=builder --chown=nextjs:nodejs /app/tsconfig.json ./tsconfig.json

# Copy shell entrypoint (runs as root for user setup, then drops privileges)
COPY --chown=root:root scripts/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# Copy compiled JS entrypoint (runs as target user after privilege drop)
COPY --from=builder --chown=nextjs:nodejs /app/dist/entrypoint.cjs ./dist/

# Copy only migration dependencies instead of all node_modules
# The standalone build's node_modules don't include deps needed by lib/db/migrate.ts
# and companion migrations (date-fns, date-fns-tz for timezone conversions)
# This optimization significantly reduces image size by copying only what's needed
COPY --from=migration-deps --chown=nextjs:nodejs /app/node_modules ./node_modules

# DO NOT set USER here - the entrypoint handles PUID/PGID switching
# Container starts as root, then drops to specified UID/GID via su-exec
# This allows users to customize the user ID to match their host system
# Default: 1001:1001 (nextjs:nodejs) if PUID/PGID are not specified

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Volume for persistent SQLite database
VOLUME ["/app/data"]

# Use hybrid shell + compiled JS entrypoint
# Shell handles: user setup, permissions, privilege drop
# Compiled JS handles: backups, migrations, app start
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD []
