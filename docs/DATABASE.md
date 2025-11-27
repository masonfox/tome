# Database Management Guide

This guide covers database operations, schema management, and data maintenance for Tome.

## Overview

Tome uses two SQLite databases:

1. **Tome Database** (`data/tome.db`): Your reading progress, sessions, and streaks
2. **Calibre Database** (read-only): Your book metadata from Calibre

This guide focuses on managing the Tome database.

## Database Commands

### Running Migrations

Migrations create and update the database schema. They must be run before first use.

```bash
# Run all pending migrations
bun run db:migrate

# Or use the script directly
bun run lib/db/migrate.ts
```

**When to run**:
- First-time setup
- After pulling updates that change the schema
- When you see "table not found" errors

**Migration behavior**:
- **Development**: Must be run manually
- **Testing**: Runs automatically in test setup
- **Docker**: Runs automatically on container startup

### Generating Migrations

After modifying the database schema in `lib/db/schema.ts`:

```bash
# Generate migration from schema changes
bun run db:generate
```

This creates a new migration file in `drizzle/` directory with SQL statements to update the schema.

### Pushing Schema Changes (Development Only)

For rapid development iteration, you can push schema changes directly:

```bash
# Push schema directly without creating migration
bun run db:push
```

**WARNING**: This bypasses the migration system. Only use in development. Never use in production.

### Opening Drizzle Studio

Drizzle Studio provides a visual database browser:

```bash
# Open Drizzle Studio in browser
bun run db:studio
```

Access at `https://local.drizzle.studio` to browse tables, view data, and run queries.

## Backup and Restore

### Creating Backups

Tome includes built-in backup scripts with timestamped files.

```bash
# Create backup with timestamp
bun run db:backup

# Example output: data/backups/tome.db.backup-20251127_143055
```

**Backup location**: `data/backups/` directory

**Automatic backups**: Docker migrations create automatic backups before schema changes

### Listing Backups

```bash
# List all available backups with size and timestamp
bun run db:list-backups
```

### Restoring from Backup

```bash
# Interactive restore (select from list)
bun run db:restore

# Or manually copy backup
cp data/backups/tome.db.backup-YYYYMMDD_HHMMSS data/tome.db
```

**Important**: Restore stops the application during the process.

### Backup Strategy

Recommended backup practices:

1. **Before migrations**: Always backup before running migrations
2. **Regular schedule**: Weekly automated backups
3. **Before updates**: Backup before pulling application updates
4. **Before experiments**: Backup before testing new features

```bash
# Example backup script (add to cron)
#!/bin/bash
cd /path/to/tome
bun run db:backup
# Keep last 10 backups
ls -t data/backups/*.backup-* | tail -n +11 | xargs rm -f
```

## Data Models

### Books Table

Cached book metadata from Calibre with additional tracking fields.

**Key fields**:
- `id`: Book ID (from Calibre)
- `title`, `author_sort`: Book metadata
- `path`, `has_cover`: File information
- `lastSynced`: Timestamp of last Calibre sync
- `isOrphan`: True if book removed from Calibre

**Source**: Synced from Calibre's `metadata.db`

### Reading Sessions Table

Tracks each read-through of a book.

**Key fields**:
- `id`: Unique session ID
- `bookId`: Reference to book
- `status`: `to-read`, `read-next`, `reading`, `read`
- `rating`: 0-5 stars (synced with Calibre)
- `review`: Text review
- `startedDate`, `completedDate`: Session dates
- `isArchived`: True for old sessions (when re-reading)

**Notes**:
- Users can have multiple sessions per book (re-reading)
- Only one active session per book
- Previous sessions archived automatically

### Progress Logs Table

Historical log of reading progress within sessions.

**Key fields**:
- `id`: Unique log entry ID
- `sessionId`: Reference to session
- `currentPage`: Page number (if page-based tracking)
- `percentage`: Progress percentage (0-100)
- `readAt`: Timestamp of progress entry
- `notes`: Optional notes about reading session

**Notes**:
- Immutable once created (never updated)
- Supports backdated entries
- Multiple entries per day allowed

### Streaks Table

Tracks reading streak data per user.

**Key fields**:
- `userId`: User identifier
- `currentStreak`: Current consecutive days
- `longestStreak`: All-time record
- `lastActivityDate`: Last day with progress entry
- `totalDaysActive`: Total days with any reading
- `dailyGoalPages`: User's daily page goal

**Notes**:
- Streak breaks on missed days
- Calculated based on progress log entries
- Supports configurable daily goals

## Database Maintenance

### Checking Database Status

```bash
# View migration history
sqlite3 data/tome.db "SELECT * FROM __drizzle_migrations"

# Check database size
ls -lh data/tome.db

# Check table row counts
sqlite3 data/tome.db "
  SELECT 'books' as table_name, COUNT(*) as count FROM books
  UNION ALL
  SELECT 'reading_sessions', COUNT(*) FROM reading_sessions
  UNION ALL
  SELECT 'progress_logs', COUNT(*) FROM progress_logs
  UNION ALL
  SELECT 'streaks', COUNT(*) FROM streaks;
"
```

### Database Integrity Check

```bash
# Check for corruption
sqlite3 data/tome.db "PRAGMA integrity_check;"

# Should output: ok
```

### Optimizing Database

SQLite databases can become fragmented over time:

```bash
# Vacuum database to reclaim space and optimize
sqlite3 data/tome.db "VACUUM;"

# Analyze query performance
sqlite3 data/tome.db "ANALYZE;"
```

### Resetting Database

**WARNING**: This deletes all reading progress, sessions, and streaks.

```bash
# Delete database
rm data/tome.db

# Recreate schema
bun run db:migrate
```

**Alternative**: Keep database but clear specific tables:

```bash
sqlite3 data/tome.db "
  DELETE FROM progress_logs;
  DELETE FROM reading_sessions;
  DELETE FROM streaks;
  -- Books table keeps Calibre sync
"
```

## Migration System Details

### How Migrations Work

Migrations are SQL files that update the database schema incrementally.

**Migration files**: Stored in `drizzle/` directory

**Tracking**: `__drizzle_migrations` table tracks which migrations have been applied

**Execution order**: Migrations run in chronological order based on filename timestamps

### Migration Safety Features

1. **File-Based Locking**:
   - Lock file: `data/.migration.lock`
   - Prevents concurrent migrations
   - Auto-timeout: 5 minutes for stale locks

2. **Pre-Flight Checks**:
   - Data directory writable
   - Migration files present
   - Database permissions correct
   - Sufficient disk space

3. **Automatic Backups** (Docker only):
   - Created before each migration
   - Timestamped format
   - Keeps last 3 backups
   - Stored in `data/backups/`

4. **Retry Logic** (Docker only):
   - 3 retry attempts
   - Exponential backoff: 5s, 10s, 20s
   - Detailed logging

### Manual Migration Control

```bash
# Check if migrations are needed
sqlite3 data/tome.db "
  SELECT hash, created_at
  FROM __drizzle_migrations
  ORDER BY created_at DESC
  LIMIT 5;
"

# View pending migrations
ls -la drizzle/

# Force migration (bypass safety checks)
# WARNING: Use only if you know what you're doing
rm data/.migration.lock
bun run lib/db/migrate.ts
```

### Migration Rollback

Drizzle doesn't provide automatic rollback. To undo a migration:

1. **Restore from backup**:
   ```bash
   bun run db:restore
   ```

2. **Or manually reverse changes**:
   - Review migration SQL in `drizzle/`
   - Write inverse SQL statements
   - Apply manually via sqlite3

3. **Or reset and rebuild**:
   ```bash
   rm data/tome.db
   bun run db:migrate
   # Re-sync Calibre and re-enter progress (data loss)
   ```

## Advanced Operations

### Exporting Data

```bash
# Export entire database to SQL
sqlite3 data/tome.db .dump > tome-export.sql

# Export specific table
sqlite3 data/tome.db "SELECT * FROM progress_logs" > progress-export.csv

# Export as JSON (requires jq)
sqlite3 -json data/tome.db "SELECT * FROM reading_sessions" | jq '.' > sessions.json
```

### Importing Data

```bash
# Import from SQL dump
sqlite3 data/tome.db < tome-export.sql

# Import CSV into table
sqlite3 data/tome.db <<EOF
.mode csv
.import data.csv table_name
EOF
```

### Querying Data

```bash
# Open interactive shell
sqlite3 data/tome.db

# Example queries
sqlite> SELECT COUNT(*) FROM books;
sqlite> SELECT title, rating FROM books WHERE rating >= 4;
sqlite> SELECT * FROM reading_sessions WHERE status = 'reading';
sqlite> .exit
```

## Docker Database Operations

All database commands work inside Docker containers:

```bash
# Run migrations
docker exec tome bun run lib/db/migrate.ts

# Create backup
docker exec tome bun run db:backup

# List backups
docker exec tome bun run db:list-backups

# Restore (interactive)
docker exec -it tome bun run db:restore

# Open database shell
docker exec -it tome sqlite3 /app/data/tome.db

# Check database status
docker exec tome sqlite3 /app/data/tome.db "PRAGMA integrity_check;"
```

## Troubleshooting

For database-related issues, see [TROUBLESHOOTING.md](./TROUBLESHOOTING.md):

- Database not found
- Migration failures
- Corruption recovery
- Permission errors
- Lock file issues

## Best Practices

1. **Backup before changes**: Always backup before migrations or major operations
2. **Regular integrity checks**: Run monthly integrity checks
3. **Monitor size**: Track database growth over time
4. **Vacuum periodically**: Optimize database quarterly
5. **Test migrations**: Test migrations in development before production
6. **Keep backups**: Maintain at least 3 recent backups
7. **Use migrations**: Never modify schema manually in production
8. **Document changes**: Comment complex migrations

## Additional Resources

- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [SQLite Documentation](https://www.sqlite.org/docs.html)
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture details
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Production deployment guide
