#!/bin/sh
set -e

# Run database migrations
echo "Running database migrations..."
bun run lib/db/migrate.ts

# Start the application
echo "Starting application..."
exec bun server.js
