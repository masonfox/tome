#!/bin/bash
#
# Docker Entrypoint Shell Script
#
# Handles Docker housekeeping that requires root privileges:
# - User/group creation with custom PUID/PGID
# - Permission fixes for mounted volumes
# - Privilege dropping via su-exec
#
# After setup, executes the compiled Node.js entrypoint as the target user.
#

set -e

PUID=${PUID:-1001}
PGID=${PGID:-1001}

echo "============================================"
echo ""
echo "   ████████╗ ██████╗ ███╗   ███╗███████╗"
echo "   ╚══██╔══╝██╔═══██╗████╗ ████║██╔════╝"
echo "      ██║   ██║   ██║██╔████╔██║█████╗  "
echo "      ██║   ██║   ██║██║╚██╔╝██║██╔══╝  "
echo "      ██║   ╚██████╔╝██║ ╚═╝ ██║███████╗"
echo "      ╚═╝    ╚═════╝ ╚═╝     ╚═╝╚══════╝"
echo ""
echo "            PUID=${PUID}, PGID=${PGID}"
echo ""
echo "============================================"
echo ""

# Setup group with target GID if it doesn't exist
if ! getent group "${PGID}" > /dev/null 2>&1; then
    echo "Creating group with GID=${PGID}..."
    # Remove default nodejs group if it exists
    delgroup nodejs 2>/dev/null || true
    addgroup -g "${PGID}" -S nodejs
fi

# Setup user with target UID if it doesn't exist
if ! getent passwd "${PUID}" > /dev/null 2>&1; then
    echo "Creating user with UID=${PUID}..."
    # Remove default nextjs user if it exists
    deluser nextjs 2>/dev/null || true
    adduser -u "${PUID}" -S nextjs -G nodejs
fi

# Get the username for the target UID (might not be 'nextjs' if user already existed)
USERNAME=$(getent passwd "${PUID}" | cut -d: -f1)

echo "Running as user: ${USERNAME} (${PUID}:${PGID})"
echo ""

# Fix ownership of data directory
if [ -d "/app/data" ]; then
    echo "Fixing ownership of /app/data..."
    chown -R "${PUID}:${PGID}" /app/data 2>/dev/null || echo "Warning: Could not change ownership of /app/data (may be a network mount)"
fi

# Fix ownership of .next directory (needed for runtime cache writes)
if [ -d "/app/.next" ]; then
    echo "Fixing ownership of /app/.next..."
    chown -R "${PUID}:${PGID}" /app/.next 2>/dev/null || echo "Warning: Could not change ownership of /app/.next"
fi

echo ""
echo "Dropping privileges and starting application..."
echo ""

# Drop privileges and execute Node.js entrypoint
# su-exec replaces the current process (like exec)
exec su-exec "${PUID}:${PGID}" npx tsx /app/dist/entrypoint.cjs
