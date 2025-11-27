#!/bin/bash
set -e

# Manual Database Backup Script
#
# Creates a timestamped backup of the SQLite database.
# Includes WAL and SHM files for consistency.
#
# Usage:
#   bash scripts/backup-database.sh
#   bun run db:backup

# Configuration
DATABASE_PATH="${DATABASE_PATH:-./data/tome.db}"
BACKUP_DIR="${BACKUP_DIR:-./data/backups}"

echo "=== Database Backup Utility ==="
echo ""

# Check if database exists
if [ ! -f "$DATABASE_PATH" ]; then
  echo "❌ Error: Database not found at: $DATABASE_PATH"
  echo ""
  echo "Please ensure DATABASE_PATH is set correctly."
  exit 1
fi

# Create backup directory if it doesn't exist
if [ ! -d "$BACKUP_DIR" ]; then
  echo "Creating backup directory: $BACKUP_DIR"
  mkdir -p "$BACKUP_DIR" || {
    echo "❌ Error: Failed to create backup directory"
    exit 1
  }
fi

# Verify backup directory is writable
if [ ! -w "$BACKUP_DIR" ]; then
  echo "❌ Error: Backup directory is not writable: $BACKUP_DIR"
  echo "Current user: $(id)"
  echo "Directory permissions: $(ls -ld "$BACKUP_DIR")"
  exit 1
fi

# Generate timestamp and date-based folder
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DATE_FOLDER=$(date +%Y-%m-%d)
BACKUP_NAME="tome.db.backup-${TIMESTAMP}"
BACKUP_FOLDER="${BACKUP_DIR}/${DATE_FOLDER}"
BACKUP_PATH="${BACKUP_FOLDER}/${BACKUP_NAME}"

# Create date-based backup folder
echo "Creating backup folder: $BACKUP_FOLDER"
mkdir -p "$BACKUP_FOLDER" || {
  echo "❌ Error: Failed to create backup folder"
  exit 1
}

echo "Database: $DATABASE_PATH"
echo "Backup directory: $BACKUP_FOLDER"
echo "Backup name: $BACKUP_NAME"
echo ""

# Check database integrity before backup
echo "Checking database integrity..."
if ! sqlite3 "$DATABASE_PATH" "PRAGMA integrity_check;" > /dev/null 2>&1; then
  echo "⚠️  Warning: Database integrity check failed"
  echo "Backup will proceed, but database may be corrupted"
  echo ""
fi

# Create backup
echo "Creating backup..."
cp "$DATABASE_PATH" "$BACKUP_PATH" || {
  echo "❌ Error: Failed to copy database file"
  exit 1
}

# Copy WAL file if it exists (SQLite Write-Ahead Logging)
if [ -f "${DATABASE_PATH}-wal" ]; then
  echo "Copying WAL file..."
  cp "${DATABASE_PATH}-wal" "${BACKUP_PATH}-wal"
fi

# Copy SHM file if it exists (SQLite Shared Memory)
if [ -f "${DATABASE_PATH}-shm" ]; then
  echo "Copying SHM file..."
  cp "${DATABASE_PATH}-shm" "${BACKUP_PATH}-shm"
fi

# Get backup file size
BACKUP_SIZE=$(du -h "$BACKUP_PATH" | cut -f1)

echo ""
echo "✅ Backup created successfully"
echo ""
echo "Backup location: $BACKUP_PATH"
echo "Backup size: $BACKUP_SIZE"
echo ""
echo "To restore this backup:"
echo "  bun run db:restore $BACKUP_PATH"
echo ""

# List all backups (search in date-based folders)
BACKUP_COUNT=$(find "$BACKUP_DIR" -type f -name "tome.db.backup-*" 2>/dev/null | wc -l)
echo "Total backups across all folders: $BACKUP_COUNT"

if [ "$BACKUP_COUNT" -gt 10 ]; then
  echo ""
  echo "⚠️  Note: You have $BACKUP_COUNT backups"
  echo "Consider cleaning up old backups:"
  echo "  bun run db:list-backups"
fi

echo ""
echo "=== Backup Complete ==="
