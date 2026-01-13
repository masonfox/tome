#!/bin/bash

# DEPRECATED: This script has been replaced by scripts/list-backups.ts
# Please use: npm run db:list-backups
#
# This file will be removed in a future release.
# The new TypeScript version provides:
# - Display of both Tome and Calibre backups
# - Better formatting and grouping by date
# - Consistent behavior and better error handling
# - Comprehensive automated testing
#
# For now, this script still works for Tome database only.

# List Database Backups Script
#
# Lists all available database backups with details.
# Sorted by date (newest first).
#
# Usage:
#   bash scripts/list-backups.sh
#   bun run db:list-backups

# Configuration
BACKUP_DIR="${BACKUP_DIR:-./data/backups}"

echo "=== Database Backup List ==="
echo ""

# Check if backup directory exists
if [ ! -d "$BACKUP_DIR" ]; then
	echo "❌ No backup directory found: $BACKUP_DIR"
	echo ""
	echo "Create your first backup:"
	echo "  bun run db:backup"
	exit 0
fi

# Get list of backups from date-based folders (sorted by modification time, newest first)
BACKUPS=$(find "$BACKUP_DIR" -type f -name "tome.db.backup-*" -exec ls -t {} + 2>/dev/null | grep -v '\-wal$\|\-shm$' || true)

if [ -z "$BACKUPS" ]; then
	echo "No backups found in: $BACKUP_DIR"
	echo ""
	echo "Create your first backup:"
	echo "  bun run db:backup"
	exit 0
fi

# Count backups
BACKUP_COUNT=$(echo "$BACKUPS" | wc -l)
echo "Found $BACKUP_COUNT backup(s) in: $BACKUP_DIR"
echo ""

# Calculate total backup size
TOTAL_SIZE=0

# Display each backup
INDEX=1
for BACKUP in $BACKUPS; do
	BACKUP_NAME=$(basename "$BACKUP")

	# Extract date from filename (tome.db.backup-YYYYMMDD_HHMMSS)
	TIMESTAMP=$(echo "$BACKUP_NAME" | sed 's/tome.db.backup-//')
	DATE_PART=$(echo "$TIMESTAMP" | cut -d'_' -f1)
	TIME_PART=$(echo "$TIMESTAMP" | cut -d'_' -f2)

	# Format date and time
	YEAR="${DATE_PART:0:4}"
	MONTH="${DATE_PART:4:2}"
	DAY="${DATE_PART:6:2}"
	HOUR="${TIME_PART:0:2}"
	MINUTE="${TIME_PART:2:2}"
	SECOND="${TIME_PART:4:2}"

	FORMATTED_DATE="$YEAR-$MONTH-$DAY $HOUR:$MINUTE:$SECOND"

	# Get file size in human-readable format
	SIZE=$(du -h "$BACKUP" | cut -f1)

	# Get file size in bytes for total calculation
	SIZE_BYTES=$(stat -c%s "$BACKUP" 2>/dev/null || stat -f%z "$BACKUP" 2>/dev/null || echo "0")
	TOTAL_SIZE=$((TOTAL_SIZE + SIZE_BYTES))

	# Check if WAL and SHM files exist
	EXTRA_FILES=""
	[ -f "${BACKUP}-wal" ] && EXTRA_FILES="${EXTRA_FILES}+WAL "
	[ -f "${BACKUP}-shm" ] && EXTRA_FILES="${EXTRA_FILES}+SHM "

	# Get the date folder from the path
	FOLDER_NAME=$(basename "$(dirname "$BACKUP")")

	# Display backup info
	echo "[$INDEX] $BACKUP_NAME"
	echo "    Date: $FORMATTED_DATE"
	echo "    Folder: $FOLDER_NAME"
	echo "    Size: $SIZE $EXTRA_FILES"
	echo "    Path: $BACKUP"
	echo ""

	INDEX=$((INDEX + 1))
done

# Display total size
TOTAL_SIZE_MB=$((TOTAL_SIZE / 1024 / 1024))
echo "Total backup size: ${TOTAL_SIZE_MB}MB"
echo ""

# Show commands for management
echo "Backup Management Commands:"
echo "  Create new backup:    bun run db:backup"
echo "  Restore from backup:  bun run db:restore"
echo ""

# Warn if too many backups
if [ "$BACKUP_COUNT" -gt 10 ]; then
	echo "⚠️  Note: You have $BACKUP_COUNT backups"
	echo "Consider cleaning up old backups to save disk space."
	echo ""
	echo "To manually delete old backups:"
	echo "  rm $BACKUP_DIR/tome.db.backup-YYYYMMDD_HHMMSS"
	echo ""
fi

# Show automatic cleanup info
echo "Docker automatic backups keep the last 3 backups only."
echo "Manual backups (created with this script) are not automatically cleaned up."
echo ""

echo "=== End of Backup List ==="
