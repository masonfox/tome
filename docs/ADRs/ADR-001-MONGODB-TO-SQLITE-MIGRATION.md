# ADR-001: MongoDB to SQLite Migration

## Status
✅ **Implemented** - November 19, 2025

## Context

Tome started as a self-hosted book tracking application using MongoDB for storing reading progress data (books, sessions, progress logs, streaks). While MongoDB is a powerful database, it introduced unnecessary complexity for a self-hosted application:

### Problems with MongoDB
1. **External Dependency**: Required Docker/Docker Compose to run MongoDB
2. **Setup Complexity**: Users needed to install Docker, start containers, and manage MongoDB
3. **Resource Usage**: MongoDB container consumed significant memory even for small datasets
4. **Single-User Focus**: The app is designed for single users, not requiring MongoDB's distributed/horizontal scaling features
5. **Data Locality**: Reading data from Calibre's SQLite while tracking data lived in MongoDB created split persistence

### Opportunity with SQLite
1. **Zero External Dependencies**: SQLite runs in-process with Bun's native `bun:sqlite` driver
2. **Simpler Deployment**: Single file database (`data/tome.db`) with no setup required
3. **Better Performance**: No network overhead, direct file access
4. **Data Locality**: Both Calibre data (read-only) and tracking data use SQLite
5. **Easier Backups**: Just copy `data/tome.db`
6. **Perfect for Self-Hosted**: Designed for embedded/single-user applications

## Decision

We migrated from MongoDB to SQLite using **Drizzle ORM** with **bun:sqlite** as the driver.

### Why Drizzle ORM over Prisma?

**Drizzle** was chosen over Prisma for several reasons:

1. **SQL-like Syntax**: Drizzle's query builder feels more like writing SQL, making it easier to understand and debug
2. **Lightweight**: No heavy code generation step; schema is defined in TypeScript
3. **Type Safety**: Full TypeScript support with inferred types from schema
4. **Better SQLite Support**: First-class support for SQLite-specific features (partial indexes, CHECK constraints)
5. **Bun Compatibility**: Works seamlessly with `bun:sqlite` (Bun's native SQLite driver)
6. **Migration Control**: Simple SQL migration files that can be easily customized

### Why bun:sqlite over better-sqlite3?

1. **Native to Bun**: Built into the Bun runtime, no compilation required
2. **No ABI Issues**: Avoided ABI version mismatches that plagued better-sqlite3
3. **Better Performance**: Optimized for Bun's runtime
4. **Zero npm Dependencies**: One less dependency to manage

## Implementation

### Schema Design

Four main tables were created to match the previous MongoDB collections:

#### 1. **books** table
- Stores cached book metadata from Calibre
- Includes tracking fields (orphaned, lastSynced)
- JSON columns for arrays (authors, tags)
- Unique constraint on `calibreId`

#### 2. **reading_sessions** table
- Tracks reading sessions per book
- Status enum: to-read, read-next, reading, read
- Unique constraints:
  - One active session per book (partial unique index)
  - Unique (bookId, sessionNumber) pairs
- CHECK constraint: rating between 1-5
- Foreign key to books with CASCADE delete

#### 3. **progress_logs** table
- Historical reading progress entries
- CHECK constraints:
  - currentPage >= 0
  - currentPercentage between 0-100
  - pagesRead >= 0
- Foreign keys to books and sessions with CASCADE delete
- Indexed on (bookId, progressDate) for efficient queries

#### 4. **streaks** table
- Singleton pattern: one streak per user
- Unique index on COALESCE(userId, -1) to handle NULL values
- Tracks current/longest streaks and total days active

### Repository Pattern

Implemented a clean repository layer to abstract database access:

```
lib/repositories/
├── base.repository.ts       # Generic CRUD operations
├── book.repository.ts        # Book-specific queries
├── session.repository.ts     # Session management
├── progress.repository.ts    # Progress tracking
├── streak.repository.ts      # Streak calculations
└── index.ts                  # Exports all repositories
```

Benefits:
- **Separation of Concerns**: Database logic isolated from business logic
- **Testability**: Easy to mock repositories for testing
- **Type Safety**: Full TypeScript support with Drizzle's inferred types
- **Consistency**: Standardized patterns across all data access

### Migration Process

1. **Schema Creation** (Phase 1)
   - Defined Drizzle schemas in `lib/db/schema/`
   - Generated initial migration with `drizzle-kit generate`
   - Added CHECK constraints for data validation

2. **Repository Implementation** (Phase 2)
   - Built `BaseRepository` with generic CRUD operations
   - Implemented specific repositories with domain logic
   - Added complex query methods (filtering, pagination, aggregations)

3. **API Route Migration** (Phase 3)
   - Updated all 10 API routes to use repositories
   - Replaced Mongoose calls with repository methods
   - Maintained existing API contracts

4. **Service Layer Migration** (Phase 4)
   - Updated `sync-service.ts` for Calibre synchronization
   - Updated `dashboard-service.ts` for statistics
   - Updated `streaks.ts` for streak calculations

5. **Testing** (Phase 5)
   - Created 51 new SQLite-specific unit tests:
     - 11 constraint tests (foreign keys, unique indexes, CHECK constraints)
     - 8 aggregation tests (SUM, COUNT, AVG, activity calendar)
     - 15 search tests (case-insensitive, partial matching, tag filtering)
     - 17 edge case tests (empty arrays, null values, pagination)
   - All tests pass ✅

6. **Cleanup** (Phase 6)
   - Removed MongoDB dependencies from package.json
   - Updated README with SQLite instructions
   - Documented migration in this ADR

## Consequences

### Positive
✅ **Simplified Deployment**: No Docker required, just run `bun install && bun run dev`
✅ **Better Performance**: Eliminated network latency, direct file access
✅ **Reduced Resource Usage**: No MongoDB container consuming 500MB+ RAM
✅ **Easier Backups**: Single file (`data/tome.db`) to copy
✅ **Data Locality**: Both Calibre and tracking data use SQLite
✅ **Type Safety**: Drizzle's TypeScript support catches errors at compile time
✅ **Better DX**: SQL-like query syntax is more intuitive

### Negative
⚠️ **Existing Tests Need Migration**: Old MongoDB-based tests in `__tests__/api/` and `__tests__/unit/lib/` still use Mongoose models
⚠️ **No Horizontal Scaling**: SQLite doesn't support multiple concurrent writers (not needed for single-user app)
⚠️ **Breaking Change**: Users with existing MongoDB data need to re-import from Calibre

### Neutral
ℹ️ **New Learning Curve**: Team needs to learn Drizzle ORM and SQLite specifics
ℹ️ **Migration Responsibility**: Users handle schema changes via migration files

## Migration Guide for Users

### For New Users
No changes! Just follow the updated README:
```bash
bun install
bun run lib/db/migrate.ts
bun run dev
```

### For Existing Users (MongoDB → SQLite)
1. **Backup MongoDB data** (optional, for reference)
   ```bash
   # Export your books/sessions/progress if you want to keep records
   ```

2. **Pull latest code**
   ```bash
   git pull origin main
   bun install
   ```

3. **Run migrations**
   ```bash
   bun run lib/db/migrate.ts
   ```

4. **Re-sync from Calibre**
   - Visit Settings page
   - Click "Sync Now"
   - Your books will be imported fresh from Calibre
   - Note: Progress history and streaks will be lost (re-log as needed)

5. **Remove Docker (optional)**
   ```bash
   docker-compose down -v  # Removes MongoDB container and data
   ```

## Future Considerations

1. **Test Migration**: Gradually migrate existing MongoDB tests to use repositories
2. **Data Import Tool**: Build a tool to import MongoDB exports into SQLite (if users request it)
3. **Multi-User Support**: If needed, consider PostgreSQL (Drizzle supports it) or multiple SQLite databases
4. **Replication**: For advanced users, consider Litestream for SQLite replication/backups

## References

- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [Bun SQLite Documentation](https://bun.sh/docs/api/sqlite)
- [SQLite Documentation](https://www.sqlite.org/docs.html)
- [Migration Analysis](./SQLITE_MIGRATION_ANALYSIS.md)

## Related Files

Schema:
- `lib/db/schema/books.ts`
- `lib/db/schema/reading-sessions.ts`
- `lib/db/schema/progress-logs.ts`
- `lib/db/schema/streaks.ts`

Database:
- `lib/db/sqlite.ts` - Connection management
- `lib/db/migrate.ts` - Migration runner
- `drizzle.config.ts` - Drizzle configuration

Repositories:
- `lib/repositories/base.repository.ts`
- `lib/repositories/book.repository.ts`
- `lib/repositories/session.repository.ts`
- `lib/repositories/progress.repository.ts`
- `lib/repositories/streak.repository.ts`

Tests:
- `__tests__/unit/constraints.test.ts` (11 tests)
- `__tests__/unit/aggregations.test.ts` (8 tests)
- `__tests__/unit/search.test.ts` (15 tests)
- `__tests__/unit/edge-cases.test.ts` (17 tests)

Migrations:
- `drizzle/0000_unique_susan_delgado.sql` - Initial schema
- `drizzle/0001_yellow_human_robot.sql` - CHECK constraints
- `drizzle/0002_lame_dust.sql` - Streak unique index fix

---

**Decision Made By**: Claude Code (AI Assistant)
**Date**: November 19, 2025
**Reviewed By**: User (masonfox)
**Status**: ✅ Implemented and Verified
