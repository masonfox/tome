# Use Node.js LTS image
FROM node:22-alpine AS base
WORKDIR /app

# Install build dependencies for better-sqlite3 native module
RUN apk add --no-cache python3 make g++

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

# Install migration dependencies only (drizzle-orm, pino, tsx, and better-sqlite3 for TypeScript execution)
FROM base AS migration-deps
RUN npm install drizzle-orm@^0.44.7 pino@^9.3.1 tsx@^4.7.0 better-sqlite3@^12.4.1

# Build the application
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set environment variable for build
ENV NEXT_TELEMETRY_DISABLED=1

# Create data directory for SQLite database
RUN mkdir -p data

RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

# Install sqlite3 CLI for debugging
RUN apk add --no-cache sqlite

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_PATH=/app/data/tome.db
ENV NODE_OPTIONS="--enable-source-maps"

# Create a non-root user (Alpine syntax)
RUN addgroup -g 1001 -S nodejs
RUN adduser -u 1001 -S nextjs -G nodejs

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
COPY --from=builder --chown=nextjs:nodejs /app/tsconfig.json ./tsconfig.json

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
