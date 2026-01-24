#!/bin/bash
#
# Docker Entrypoint Shell Script
#
# Handles Docker housekeeping that requires root privileges:
# - User/group creation with custom PUID/PGID
# - Permission fixes for mounted volumes
# - Privilege dropping via su-exec
#
# Runs silently - all user-facing output is handled by the TypeScript entrypoint.
# Only critical errors are output to stderr with [shell] prefix.
#

set -e

PUID=${PUID:-1001}
PGID=${PGID:-1001}

# Setup user and group with target PUID/PGID if they don't exist
# Note: Delete user BEFORE group (user might be member of group)
if ! getent passwd "${PUID}" >/dev/null 2>&1; then
	# Remove default nextjs user if it exists (do this first)
	deluser nextjs 2>/dev/null || true
fi

if ! getent group "${PGID}" >/dev/null 2>&1; then
	# Remove default nodejs group if it exists (after removing user)
	delgroup nodejs 2>/dev/null || true
	addgroup -g "${PGID}" -S nodejs || {
		echo "[shell] ERROR: Failed to create group with GID=${PGID}" >&2
		exit 1
	}
fi

# Create user if it doesn't exist (after group is ready)
if ! getent passwd "${PUID}" >/dev/null 2>&1; then
	adduser -u "${PUID}" -S nextjs -G nodejs || {
		echo "[shell] ERROR: Failed to create user with UID=${PUID}" >&2
		exit 1
	}
fi

# Fix ownership of data directory (silent unless error)
if [ -d "/app/data" ]; then
	chown -R "${PUID}:${PGID}" /app/data 2>/dev/null || {
		echo "[shell] WARNING: Could not change ownership of /app/data (may be network mount)" >&2
	}
fi

# Fix ownership of .next directory (needed for runtime cache writes)
if [ -d "/app/.next" ]; then
	chown -R "${PUID}:${PGID}" /app/.next 2>/dev/null || {
		echo "[shell] WARNING: Could not change ownership of /app/.next" >&2
	}
fi

# Ensure stdout is flushed before handing off to TypeScript entrypoint
sync

# Drop privileges and execute compiled Node.js entrypoint
# Path aliases (@/) already resolved by esbuild during build
# tsx is NOT needed here - entrypoint is pre-compiled JavaScript
# su-exec replaces the current process (like exec)
exec su-exec "${PUID}:${PGID}" node /app/dist/entrypoint.cjs
