#!/bin/sh
set -e

DATABASE_PATH="${DATABASE_PATH:-./data/tome.db}"
DATA_DIR=$(dirname "$DATABASE_PATH")
MAX_RETRIES=3
RETRY_DELAY=5

# Display banner with version
show_banner() {
  # Try to find package.json in common locations
  if [ -f "/app/package.json" ]; then
    VERSION=$(grep '"version"' /app/package.json | head -1 | awk -F'"' '{print $4}')
  elif [ -f "./package.json" ]; then
    VERSION=$(grep '"version"' ./package.json | head -1 | awk -F'"' '{print $4}')
  elif [ -f "package.json" ]; then
    VERSION=$(grep '"version"' package.json | head -1 | awk -F'"' '{print $4}')
  else
    VERSION="unknown"
  fi
  
  echo ""
  echo "============================================"
  echo ""
  echo "   ████████╗ ██████╗ ███╗   ███╗███████╗"
  echo "   ╚══██╔══╝██╔═══██╗████╗ ████║██╔════╝"
  echo "      ██║   ██║   ██║██╔████╔██║█████╗  "
  echo "      ██║   ██║   ██║██║╚██╔╝██║██╔══╝  "
  echo "      ██║   ╚██████╔╝██║ ╚═╝ ██║███████╗"
  echo "      ╚═╝    ╚═════╝ ╚═╝     ╚═╝╚══════╝"
  echo ""
  echo "              Version: ${VERSION}"
  echo ""
  echo "============================================"
  echo ""
}

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
    # Use dedicated backups directory with date-based folders
    DATA_DIR=$(dirname "$DATABASE_PATH")
    BACKUP_DIR="${DATA_DIR}/backups"
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    DATE_FOLDER=$(date +%Y-%m-%d)
    BACKUP_FOLDER="${BACKUP_DIR}/${DATE_FOLDER}"

    # Create date-based backup folder if it doesn't exist
    if [ ! -d "$BACKUP_FOLDER" ]; then
      echo "Creating backup folder: ${BACKUP_FOLDER}"
      mkdir -p "$BACKUP_FOLDER" || {
        echo "ERROR: Failed to create backup folder"
        return 1
      }
    fi

    BACKUP_BASE=$(basename "$DATABASE_PATH")
    BACKUP_PATH="${BACKUP_FOLDER}/${BACKUP_BASE}.backup-${TIMESTAMP}"

    echo "Creating database backup: ${BACKUP_PATH}"
    cp "$DATABASE_PATH" "$BACKUP_PATH"

    # Keep only last 3 backups across all date folders
    find "$BACKUP_DIR" -type f -name "${BACKUP_BASE}.backup-*" -print0 2>/dev/null | \
      xargs -0 ls -t 2>/dev/null | tail -n +4 | xargs -r rm -f

    # Remove empty date folders after cleanup
    find "$BACKUP_DIR" -mindepth 1 -type d -empty -delete 2>/dev/null || true

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

    # Capture both stdout and stderr, display in real-time
    if npx tsx lib/db/migrate.ts 2>&1; then
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
        echo "Last exit code: $exit_code"
        return 1
      fi
    fi
  done
}

# Main execution
show_banner

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
exec node server.js
