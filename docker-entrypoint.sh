#!/bin/sh
set -e

DATABASE_PATH="${DATABASE_PATH:-./data/tome.db}"
DATA_DIR=$(dirname "$DATABASE_PATH")
MAX_RETRIES=3
RETRY_DELAY=5

# Function to ensure data directory exists and is writable
ensure_data_directory() {
  echo "Ensuring data directory exists: ${DATA_DIR}"

  # Create directory if it doesn't exist
  if [ ! -d "$DATA_DIR" ]; then
    echo "Creating data directory..."
    mkdir -p "$DATA_DIR" 2>&1 || {
      echo "ERROR: Failed to create data directory: ${DATA_DIR}"
      echo "This usually indicates a permission problem."
      exit 1
    }
  fi

  # Verify we can write to the directory
  if [ ! -w "$DATA_DIR" ]; then
    echo "ERROR: Data directory is not writable: ${DATA_DIR}"
    echo "Current user: $(id)"
    echo "Directory permissions: $(ls -ld "$DATA_DIR" 2>/dev/null || echo 'cannot read')"
    echo ""
    echo "This is usually caused by Docker volume mount permission issues."
    echo "Solutions:"
    echo "  1. Ensure Docker volume has correct permissions"
    echo "  2. Run container with correct user: --user 1001:1001"
    echo "  3. Or run with: docker run --user \$(id -u):\$(id -g) ..."
    exit 1
  fi

  echo "Data directory ready: ${DATA_DIR}"
}

# Function to create backup of database
backup_database() {
  if [ -f "$DATABASE_PATH" ]; then
    # Use dedicated backups directory
    DATA_DIR=$(dirname "$DATABASE_PATH")
    BACKUP_DIR="${DATA_DIR}/backups"

    # Create backups directory if it doesn't exist
    if [ ! -d "$BACKUP_DIR" ]; then
      echo "Creating backup directory: ${BACKUP_DIR}"
      mkdir -p "$BACKUP_DIR" || {
        echo "ERROR: Failed to create backup directory"
        return 1
      }
    fi

    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_BASE=$(basename "$DATABASE_PATH")
    BACKUP_PATH="${BACKUP_DIR}/${BACKUP_BASE}.backup-${TIMESTAMP}"

    echo "Creating database backup: ${BACKUP_PATH}"
    cp "$DATABASE_PATH" "$BACKUP_PATH"

    # Keep only last 3 backups in the backups directory
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

# Ensure data directory exists and is writable FIRST
ensure_data_directory

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
