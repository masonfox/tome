# Use Bun image
FROM oven/bun:1.3.0 AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json bun.lock ./
# Skip postinstall scripts to avoid building better-sqlite3 native module
# (Docker uses bun:sqlite at runtime, better-sqlite3 only needed for Turbopack resolution)
RUN bun install --frozen-lockfile --ignore-scripts

# Install production dependencies only
FROM base AS prod-deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production --ignore-scripts

# Install migration dependencies only (drizzle-orm and pino for migration scripts)
FROM base AS migration-deps
RUN bun add drizzle-orm@^0.44.7 pino@^9.3.1

# Build the application
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set environment variable for build
ENV NEXT_TELEMETRY_DISABLED=1

# Create data directory for SQLite database
RUN mkdir -p data

RUN bun run build

# Production image
FROM base AS runner
WORKDIR /app

# Install sqlite3 CLI for debugging
RUN apt-get update && apt-get install -y sqlite3 && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_PATH=/app/data/tome.db

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Create data directory and set permissions
RUN mkdir -p data && chown -R nextjs:nodejs data

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy database files and migration scripts
COPY --from=builder --chown=nextjs:nodejs /app/data ./data
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle
COPY --from=builder --chown=nextjs:nodejs /app/lib ./lib
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts

# Copy only migration dependencies (drizzle-orm and pino) instead of all node_modules
# The standalone build's node_modules don't include deps needed by lib/db/migrate.ts
# This optimization significantly reduces image size by copying only what's needed
COPY --from=migration-deps --chown=nextjs:nodejs /app/node_modules ./node_modules

# Copy and set up entrypoint script
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Volume for persistent SQLite database
VOLUME ["/app/data"]

CMD ["./docker-entrypoint.sh"]
