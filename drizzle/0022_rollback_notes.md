# Migration 0022 Rollback Notes

## Why This Was Deleted

Migration 0022 originally added the `source` field to the books table. 
This field has been superseded by the `book_sources` many-to-many table 
to enable multi-source support (e.g., books existing in both Calibre and Audiobookshelf).

## Original Migration (Deleted 2026-02-13)

The original migration 0022 (`0022_thankful_masque.sql`) contained:
- Added `source` field to books table (enum: 'calibre' | 'manual', default 'calibre')
- Added `idx_books_source` index for efficient filtering
- Added `provider_configs` table
- Backfilled all existing books with `source='calibre'`

## New Migration 0022 (Regenerated 2026-02-13)

The regenerated migration 0022 will contain:
- Creates `book_sources` table (many-to-many relationship)
- Creates `provider_configs` table (unchanged from original)
- Migrates data from `books.source` → `book_sources` table (via companion migration)
- Removes `books.source` field
- Removes `idx_books_source` index
- Removes 'manual' from provider_configs (no longer needed)

## Key Architectural Changes

### Before (Single Source)
- Books had a single `source` field: 'calibre' or 'manual'
- Manual books used a 'manual' provider config
- Books could only exist in one source at a time

### After (Many-to-Many Sources)
- Books can have multiple entries in `book_sources` table
- Each entry represents a source provider (calibre, audiobookshelf, etc.)
- Books with zero entries in `book_sources` are implicitly "manual" or "unconnected"
- No 'manual' provider config needed
- Enables future multi-source support

## Data Migration Strategy

The companion migration (`lib/migrations/0022_seed_provider_configs.ts`) handles:

1. **Calibre books**: All books with `source='calibre'` and a valid `calibre_id` get an entry in `book_sources`:
   ```sql
   INSERT INTO book_sources (book_id, provider_id, external_id, is_primary, ...)
   SELECT id, 'calibre', CAST(calibre_id AS TEXT), 1, ...
   FROM books
   WHERE source = 'calibre' AND calibre_id IS NOT NULL
   ```

2. **Manual books**: Books with `source='manual'` get NO entry in `book_sources` (implicit manual)

## Safe to Delete?

✅ **YES** - This was a pre-production migration that was never deployed to users.

The database currently has:
- 894 books total (893 Calibre, 1 Manual)
- Migration 0022 exists but is being superseded by the new architecture

## Rollback Plan (If Needed)

If we need to rollback this refactor:

1. Restore the original `0022_thankful_masque.sql` from git history
2. Run: `bunx drizzle-kit drop` to remove the new migration
3. Revert schema changes in `lib/db/schema/books.ts` and `lib/db/schema/book-sources.ts`
4. Restore original repository, service, and UI code
5. Run: `bunx drizzle-kit push` to apply the original migration

## Related Files

- `lib/db/schema/book-sources.ts` - New many-to-many table
- `lib/db/schema/books.ts` - Source field removed, calibreId marked deprecated
- `lib/migrations/0022_seed_provider_configs.ts` - Companion migration with data migration
- `specs/003-non-calibre-books/` - Spec documentation (Architectural Revision #2)
- `.opencode/plans/book-sources-refactor.md` - Complete implementation plan

## Timeline

- **2026-02-13**: Migration 0022 deleted and regenerated as part of book sources refactor (Spec 003, Phase R1)
- **Original creation**: Part of Spec 003 initial implementation
- **Expected completion**: 2-3 days (Phase R1: 22 hours total)
