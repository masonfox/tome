# Tome Operational Scripts

This directory contains operational scripts for database management, backup/restore operations, and utility tasks.

## Scripts Overview

### Database Backup & Restore

#### `backup-database.sh`
Creates a timestamped backup of the SQLite database.

**Usage:**
```bash
# Via npm/bun script (recommended)
bun run db:backup

# Direct execution
bash scripts/backup-database.sh
```

**Details:**
- Backup location: `./data/backups/`
- Naming pattern: `tome.db.backup-YYYYMMDD_HHMMSS`
- Includes WAL and SHM files for consistency
- Validates database integrity before backup

---

#### `restore-database.sh`
Restores the database from a backup file.

**Usage:**
```bash
# Interactive mode (recommended)
bun run db:restore

# Restore specific backup
bash scripts/restore-database.sh data/backups/tome.db.backup-20251122_143055

# List and select interactively
bash scripts/restore-database.sh
```

**Details:**
- Creates safety backup before restore
- Validates backup file integrity
- Stops application before restore (Docker mode)
- Supports both interactive and CLI modes

**⚠️ WARNING:** Restoring a backup will overwrite the current database!

---

#### `list-backups.sh`
Lists available database backups.

**Usage:**
```bash
# Via npm/bun script
bun run db:list-backups

# Direct execution
bash scripts/list-backups.sh
```

**Output:**
- Backup filename
- File size
- Timestamp
- Sorted by date (newest first)

---

### Calibre Integration

#### `sync-calibre.ts`
Manually triggers a full Calibre library sync.

**Usage:**
```bash
# Via npm/bun script (recommended)
bun run sync-calibre

# Direct execution
bun run scripts/sync-calibre.ts
```

**Details:**
- Requires `CALIBRE_DB_PATH` environment variable
- Syncs all books from Calibre to Tome database
- Updates existing books, adds new books
- Shows sync statistics on completion

---

## Environment Variables

Scripts respect the following environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_PATH` | `./data/tome.db` | Path to Tome SQLite database |
| `BACKUP_DIR` | `./data/backups` | Directory for database backups |
| `CALIBRE_DB_PATH` | (required) | Path to Calibre metadata.db |

## Docker Usage

In Docker environments, backups are automatically created before migrations. Manual backup/restore scripts work inside containers:

```bash
# Backup inside container
docker exec tome bun run db:backup

# List backups inside container
docker exec tome bun run db:list-backups

# Restore (interactive)
docker exec -it tome bun run db:restore
```

## Safety Guidelines

### Before Restoring a Backup

1. **Stop the application** (Docker: `docker-compose down`)
2. **Create a safety backup** (done automatically by restore script)
3. **Verify backup integrity** (done automatically by restore script)
4. **Have a rollback plan**

### Backup Retention

- Docker automatic backups: **Last 3 backups** (configured in docker-entrypoint.sh)
- Manual backups: **No automatic cleanup** (use `list-backups.sh` to review)
- Recommendation: Keep 7-14 days of backups, or before major changes

### Backup Best Practices

✅ **DO:**
- Backup before database migrations
- Backup before major data operations
- Test restore process periodically
- Keep backups outside the container (use Docker volumes)

❌ **DON'T:**
- Backup while application is running heavy write operations
- Rely solely on automatic backups for production
- Store backups in the same filesystem as the database
- Delete backups without verifying newer ones exist

## Development Workflows

### Before Database Migration

```bash
# 1. Create a backup
bun run db:backup

# 2. Run migration
bun run db:migrate

# 3. If migration fails, restore
bun run db:restore
```

### After Breaking Changes

```bash
# List recent backups
bun run db:list-backups

# Restore to last known good state
bun run db:restore
```

### Production Deployment

```bash
# In CI/CD pipeline:
# 1. Backup current production database
docker exec tome bun run db:backup

# 2. Deploy new version (includes migration)
docker-compose up -d

# 3. Verify application health
# 4. If issues, rollback:
docker exec -it tome bun run db:restore
```

## Troubleshooting

### "Database is locked" Error

**Cause:** Another process is accessing the database.

**Solution:**
1. Stop the application: `docker-compose down` or `Ctrl+C`
2. Wait 5 seconds for connections to close
3. Retry the operation

### "Backup directory does not exist"

**Cause:** `./data/backups/` directory not created.

**Solution:**
```bash
mkdir -p ./data/backups
```

### "CALIBRE_DB_PATH not set"

**Cause:** sync-calibre script requires Calibre database path.

**Solution:**
```bash
# Set environment variable
export CALIBRE_DB_PATH="/path/to/calibre/metadata.db"

# Or use .env file
echo "CALIBRE_DB_PATH=/path/to/calibre/metadata.db" >> .env
```

## Related Documentation

- **Database Architecture**: [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md)
- **Migration System**: [docs/SQLITE_MIGRATION_STATUS.md](../docs/SQLITE_MIGRATION_STATUS.md)
- **SQLite Driver Pattern**: [docs/sqlite-driver-consolidation.md](../docs/sqlite-driver-consolidation.md)
- **Main README**: [README.md](../README.md)

---

**Last Updated:** 2025-11-22
