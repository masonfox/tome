#!/bin/sh
set -e

DATABASE_PATH="${DATABASE_PATH:-./data/tome.db}"
MAX_RETRIES=3
RETRY_DELAY=5

# Function to create backup of database
backup_database() {
  if [ -f "$DATABASE_PATH" ]; then
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_PATH="${DATABASE_PATH}.backup-${TIMESTAMP}"

    echo "Creating database backup: ${BACKUP_PATH}"
    cp "$DATABASE_PATH" "$BACKUP_PATH"

    # Keep only last 3 backups
    BACKUP_DIR=$(dirname "$DATABASE_PATH")
    BACKUP_BASE=$(basename "$DATABASE_PATH")
    ls -t "${BACKUP_DIR}/${BACKUP_BASE}.backup-"* 2>/dev/null | tail -n +4 | xargs -r rm -f

    echo "Backup created successfully"
  else
    echo "Database does not exist yet, skipping backup (first run)"
  fi
}

# Function to run migrations with retry logic
run_migrations() {
  local attempt=1
  local delay=$RETRY_DELAY

  while [ $attempt -le $MAX_RETRIES ]; do
    echo "Migration attempt $attempt of $MAX_RETRIES..."

    if bun run lib/db/migrate.ts; then
      echo "Migrations completed successfully"
      return 0
    else
      exit_code=$?
      echo "Migration attempt $attempt failed with exit code $exit_code"

      if [ $attempt -lt $MAX_RETRIES ]; then
        echo "Retrying in ${delay} seconds..."
        sleep $delay
        delay=$((delay * 2))  # Exponential backoff
        attempt=$((attempt + 1))
      else
        echo "All migration attempts failed"
        return 1
      fi
    fi
  done
}

# Main execution
echo "=== Database Migration Process ==="

# Create backup before running migrations
backup_database

# Run migrations with retry logic
if ! run_migrations; then
  echo "ERROR: Migration failed after $MAX_RETRIES attempts"
  exit 1
fi

# Start the application
echo ""
echo "=== Starting Application ==="
exec bun server.js
