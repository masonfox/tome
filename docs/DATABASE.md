# Database Guide

Quick reference for database operations, schema management, and maintenance.

## Overview

Tome uses two SQLite databases:

1. **Tome Database** (`data/tome.db`): Your reading progress, sessions, and streaks
2. **Calibre Database**: Your book metadata from Calibre

## Database Commands

| Command | Description | Usage |
|---------|-------------|-------|
| `db:migrate` | Run all pending database migrations | Required for first-time setup, after schema changes, or when seeing "table not found" errors |
| `db:generate` | Generate migration from schema changes | Run after modifying `lib/db/schema.ts` to create migration files |
| `db:push` | Push schema changes directly (no migration) | ⚠️ **Development only** - bypasses migration system |
| `db:studio` | Open Drizzle Studio visual database browser | Access at `https://local.drizzle.studio` to browse tables and data |
| `db:backup` | Create timestamped database backup | Creates backup in `data/backups/` directory |
| `db:restore` | Restore database from backup (interactive) | Select from available backups to restore |
| `db:list-backups` | List all available backups with timestamps | Shows backups in `data/backups/` with size and date |
| `db:reset` | Delete and recreate database from scratch | ⚠️ **Destructive** - Deletes all data and runs fresh migrations. Only recommended for **Dev environments**! |
| `db:seed` | Seed database with test data | Useful for development and testing |

### Common Workflows

**First-time setup:**
```bash
npm run db:migrate
```

**After schema changes:**
```bash
npm run db:generate  # Generate migration from schema
npm run db:migrate   # Apply the migration
```

**Before risky operations:**
```bash
npm run db:backup
```

**Docker containers:**
```bash
docker exec tome npm run db:backup
docker exec tome npm run db:migrate
```

## Data Schema

For complete schema details, see `lib/db/schema.ts`.

## Migrations

Migrations are SQL files in `drizzle/` that update the database schema incrementally.

**Key features:**
- Tracked in `__drizzle_migrations` table
- Run in chronological order
- File-based locking prevents concurrent runs
- Automatic backups in Docker before each migration

**To rollback:** Use `npm run db:restore` to restore from backup

## Maintenance

### Check Database Status

```bash
# View migration history
sqlite3 data/tome.db "SELECT * FROM __drizzle_migrations"

# Check database size
ls -lh data/tome.db

# Check for corruption
sqlite3 data/tome.db "PRAGMA integrity_check;"
```

### Optimize Database

```bash
# Vacuum database to reclaim space
sqlite3 data/tome.db "VACUUM;"

# Analyze query performance
sqlite3 data/tome.db "ANALYZE;"
```

### Query Data

```bash
# Open interactive shell
sqlite3 data/tome.db

# Example queries
sqlite> SELECT COUNT(*) FROM books;
sqlite> SELECT title, rating FROM books WHERE rating >= 4;
sqlite> .exit
```

## Advanced Operations

### Export/Import Data

```bash
# Export entire database to SQL
sqlite3 data/tome.db .dump > tome-export.sql

# Import from SQL dump
sqlite3 data/tome.db < tome-export.sql

# Export as JSON (requires jq)
sqlite3 -json data/tome.db "SELECT * FROM reading_sessions" | jq '.' > sessions.json
```

## Troubleshooting

For database issues, see [TROUBLESHOOTING.md](./TROUBLESHOOTING.md).

Common issues: database not found, migration failures, corruption recovery, permission errors, lock file issues.

## Additional Resources

- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [SQLite Documentation](https://www.sqlite.org/docs.html)
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Production deployment
