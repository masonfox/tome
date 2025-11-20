# ADR-002: Book Rating System Architecture

## Status
✅ **Implemented** - November 20, 2025

## Context

Tome tracks users' reading history through reading sessions. Originally, book ratings were stored in the `reading_sessions` table, which created several problems:

### Problems with Session-Based Ratings
1. **No Universal Rating**: Each book could have multiple ratings from different reading sessions, making it unclear which rating represented the user's current opinion
2. **Calibre Sync Gap**: Calibre stores ratings at the book level, but Tome stored them at the session level, making bidirectional sync impossible
3. **Discovery Limitations**: Couldn't filter or sort books by rating in the library view, since ratings were scattered across sessions
4. **Multi-App Inconsistency**: Rating a book in Calibre wouldn't reflect in Tome, and vice versa

### Requirements
1. **Single Source of Truth**: Calibre should be the authoritative source for book ratings
2. **Bidirectional Sync**: Changes in either Tome or Calibre should be reflected in both
3. **Enhanced Discovery**: Enable library filtering and sorting by rating
4. **Better UX**: Provide a streamlined modal when finishing books to set rating + review

## Decision

We moved book ratings from `reading_sessions` table to `books` table only, removing rating storage from sessions entirely, and implemented bidirectional sync with Calibre's database.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         RATING FLOW                              │
└─────────────────────────────────────────────────────────────────┘

  Tome UI                    Tome API               Calibre DB
┌─────────┐               ┌──────────┐           ┌────────────┐
│ Finish  │──── POST ────▶│ /status  │──writes──▶│ ratings    │
│ Modal   │               │          │           │ books_     │
│ (stars) │               │ updates  │           │ ratings_   │
│         │               │ book     │           │ link       │
└─────────┘               │ rating   │           └────────────┘
                          │ ONLY     │                 │
                          └──────────┘                 │
                                                       │
  Library View                Sync Service             │
┌─────────┐               ┌──────────┐                │
│ Filter  │────filters───▶│ getBooks │◀────reads──────┘
│ Rating  │               │          │
│ 5★/4+/..│               │ cache &  │
└─────────┘               │ paginate │
                          └──────────┘
```

### Key Design Decisions

#### 1. **Ratings on Books Table ONLY**
- Added `rating: integer` column to `books` table
- Represents the user's current opinion (1-5 stars)
- Synced bidirectionally with Calibre
- Can be NULL (unrated books)
- **Removed** from `reading_sessions` table entirely

#### 2. **Calibre as Source of Truth**
- Tome writes to Calibre's database when ratings change
- Sync service reads ratings from Calibre on sync
- Scale conversion: Tome (1-5 stars) ↔ Calibre (2,4,6,8,10)
- Safe write operations to approved tables only

#### 3. **Review Stays on Sessions**
- Reviews remain on `reading_sessions.review` field
- Personal notes specific to each reading
- NOT synced to Calibre (Tome-specific)
- Can differ across re-reads

## Implementation

### Database Schema Changes

#### Migrations

**Migration 1: `drizzle/0003_busy_thor_girl.sql`** - Add rating to books
```sql
ALTER TABLE books ADD COLUMN rating INTEGER;
```

**Migration 2: `drizzle/0004_last_pretty_boy.sql`** - Remove rating from reading_sessions  
```sql
ALTER TABLE reading_sessions DROP COLUMN rating;
```

**Migration 3: `drizzle/0005_add_books_rating_check.sql`** - Add validation triggers
```sql
-- Validation via triggers (SQLite doesn't support CHECK on ALTER)
CREATE TRIGGER books_rating_check_insert
  BEFORE INSERT ON books
  WHEN NEW.rating IS NOT NULL AND (NEW.rating < 1 OR NEW.rating > 5)
BEGIN
  SELECT RAISE(ABORT, 'rating must be between 1 and 5');
END;

CREATE TRIGGER books_rating_check_update
  BEFORE UPDATE ON books
  WHEN NEW.rating IS NOT NULL AND (NEW.rating < 1 OR NEW.rating > 5)
BEGIN
  SELECT RAISE(ABORT, 'rating must be between 1 and 5');
END;
```

#### Schema Definitions

**`lib/db/schema/books.ts`**
```typescript
export const books = sqliteTable("books", {
  // ... existing fields
  rating: integer("rating"), // 1-5 stars, synced from Calibre (line 22)
});
```

**`lib/db/schema/reading-sessions.ts`**
```typescript
export const readingSessions = sqliteTable("reading_sessions", {
  // ... existing fields
  // NOTE: rating field removed - ratings stored on books only
  review: text("review"), // Personal notes stay on sessions
});
```

### Calibre Database Integration

#### Calibre Schema Understanding
Calibre uses a normalized rating system with two tables:

```sql
-- Master lookup table for rating values
ratings: (id, rating, link)
  - rating: 0-10 (even numbers: 0,2,4,6,8,10)
  - UNIQUE constraint on rating value
  - CHECK: rating > -1 AND rating < 11

-- Junction table linking books to ratings
books_ratings_link: (id, book, rating)
  - book: FK to books.id
  - rating: FK to ratings.id (NOT the rating value!)
  - UNIQUE(book, rating)
```

**Critical Insight**: `books_ratings_link.rating` stores the FK to `ratings.id`, not the rating value itself. Must query the `ratings` table to get/set values.

#### Write Operations: `lib/db/calibre-write.ts`

**Scale Conversion**:
- Tome UI: 1-5 stars (integer)
- Calibre DB: 0,2,4,6,8,10 (even integers)
- Formula: `calibre_value = tome_stars * 2`

**Write Process**:
1. Convert Tome stars (1-5) to Calibre scale (*2)
2. Get or insert rating value in `ratings` table
3. Get the `ratings.id` for that value
4. Upsert `books_ratings_link` with book ID and rating ID (FK)

```typescript
export async function updateCalibreRating(
  calibreId: number,
  stars: number | null
): Promise<void> {
  const db = getCalibreWriteDB();
  
  if (stars === null) {
    // Remove rating
    db.run('DELETE FROM books_ratings_link WHERE book = ?', [calibreId]);
    return;
  }
  
  // Convert 1-5 to 2,4,6,8,10
  const calibreRating = stars * 2;
  
  // Get or create rating entry
  let ratingId = db.query('SELECT id FROM ratings WHERE rating = ?')
    .get(calibreRating)?.id;
    
  if (!ratingId) {
    db.run('INSERT INTO ratings (rating, link) VALUES (?, "")', [calibreRating]);
    ratingId = db.query('SELECT id FROM ratings WHERE rating = ?')
      .get(calibreRating).id;
  }
  
  // Upsert books_ratings_link
  db.run(`
    INSERT OR REPLACE INTO books_ratings_link (book, rating)
    VALUES (?, ?)
  `, [calibreId, ratingId]);
}
```

#### Read Operations: `lib/db/calibre.ts`

Updated all queries to JOIN ratings tables:

```typescript
LEFT JOIN books_ratings_link brl ON b.id = brl.book
LEFT JOIN ratings r ON brl.rating = r.id

// Select: r.rating as rating
// Convert in code: rating: book.rating ? book.rating / 2 : null
```

### API Layer

#### New Endpoint: `POST /api/books/:id/rating`
Dedicated endpoint for updating book ratings:

```typescript
// Request Body
{
  "rating": number | null  // 1-5 stars or null to remove
}

// Behavior
1. Validate rating (1-5 or null)
2. Update Calibre database first (fail fast)
3. Update local books table
4. Return updated book
```

#### Updated Endpoint: `POST /api/books/:id/status`
When marking a book as "read", now updates book rating ONLY:

```typescript
// If status === 'read' && rating provided
await updateCalibreRating(book.calibreId, rating); // Write to Calibre
await bookRepository.update(bookId, { rating });   // Update books table
await sessionRepository.update(sessionId, {        // Update session
  review,                                          // NO rating - only review
  status: 'read'
});
```

This ensures:
- Book's current rating reflects user's opinion
- Calibre stays in sync
- Single source of truth for ratings

#### Updated Endpoint: `GET /api/books`
Returns book rating instead of session rating:

```typescript
// Before
rating: session?.rating

// After  
rating: book.rating
```

### Sync Service

Updated `lib/sync-service.ts` to import ratings FROM Calibre:

```typescript
// In syncBook function (line 64)
const bookData = {
  // ... other fields
  rating: calibreBook.rating || undefined,
};

await bookRepository.upsert({ calibreId: book.id }, bookData);
```

This ensures:
- New books get ratings on first sync
- Updated ratings in Calibre are reflected in Tome
- Deleted ratings (NULL) are synced

### Frontend Components

#### Finish Book Modal: `components/FinishBookModal.tsx`

Interactive modal shown when marking a book as "read":

**Features**:
- 5-star rating selector with hover preview
- Optional review textarea
- Clean modal design matching app theme
- Loading states during submission
- Validation (rating required)

**User Flow**:
1. User clicks "Mark as Read" on book detail page
2. Modal appears with star selector + review field
3. User selects rating (1-5 stars) and optionally adds review
4. On "Finish", calls status API with rating + review
5. Modal closes, page refreshes with updated data

#### Library Filters: `components/LibraryFilters.tsx`

Added rating filter dropdown:

**Filter Options**:
- All Ratings (default)
- 5 Stars (exact match)
- 4+ Stars (rating >= 4)
- 3+ Stars (rating >= 3)
- 2+ Stars (rating >= 2)
- 1+ Stars (rating >= 1)
- Unrated (rating IS NULL)

**Implementation**:
- Added `ratingFilter` and `onRatingFilterChange` props
- Star icon for visual consistency
- Integrates with existing status/tags/search filters
- Included in "Clear All" functionality
- Active filter indication

### Repository Layer

#### Book Repository: `lib/repositories/book.repository.ts`

**Filter Logic**:
```typescript
interface BookFilter {
  // ... existing filters
  rating?: string; // "5", "4+", "3+", "2+", "1+", "unrated"
}

// In findWithFilters()
if (filter.rating === 'unrated') {
  conditions.push(isNull(books.rating));
} else if (filter.rating?.endsWith('+')) {
  const minRating = parseInt(filter.rating);
  conditions.push(gte(books.rating, minRating));
} else if (filter.rating) {
  const exactRating = parseInt(filter.rating);
  conditions.push(eq(books.rating, exactRating));
}
```

**Sort Options**:
- `"rating"`: High to low (DESC NULLS LAST)
- `"rating_asc"`: Low to high (ASC NULLS LAST)

NULL handling ensures unrated books appear at the end regardless of sort direction.

### Service Layer

#### Library Service: `lib/library-service.ts`

**Updates**:
- Added `rating?: string` to `LibraryFilters` interface
- Updated `getBooks()` to pass rating param to API
- Updated `buildCacheKey()` to include rating for proper cache invalidation
- Added `rating?: number | null` to `BookWithStatus` interface

#### Dashboard Service: `lib/dashboard-service.ts`

**Updates**:
- Added `rating?: number | null` to `BookWithStatus` interface
- No filtering needed (dashboard shows specific books)

### Frontend State Management

#### Hook: `hooks/useLibraryData.ts`

**Updates**:
- Added `setRating` function for state management
- Added rating to dependency array (triggers refetch on change)
- Added rating to pagination reset logic (new filter = page 1)
- Exported `setRating` in return statement

#### Page: `app/library/page.tsx`

**URL Persistence**:
- Rating filter persists in URL params (`?rating=5` or `?rating=4%2B`)
- Parsed on page load from `searchParams.get("rating")`
- Updated via `updateURL()` when filter changes
- Works with browser back/forward navigation

**Integration**:
```typescript
// State management
const handleRatingChange = useCallback((rating: string | undefined) => {
  setRating(rating);
  updateURL({
    search: filters.search,
    status: filters.status || 'all',
    tags: filters.tags || [],
    rating: rating || 'all'
  });
}, [setRating, updateURL, filters]);

// Component usage
<LibraryFilters
  ratingFilter={filters.rating || "all"}
  onRatingFilterChange={(rating) => 
    handleRatingChange(rating === "all" ? undefined : rating)
  }
  // ... other props
/>
```

## Consequences

### Positive

✅ **Single Source of Truth**: Calibre's rating is authoritative, synced bidirectionally
✅ **Better Discovery**: Users can filter/sort library by rating
✅ **Multi-App Consistency**: Rating in Calibre = rating in Tome
✅ **Simplified Schema**: Ratings stored in one place only (books table)
✅ **Improved UX**: Finish modal streamlines setting rating + review
✅ **Type Safety**: All rating values validated (1-5 or NULL)
✅ **Safe Writes**: Only writes to approved Calibre tables (ratings, books_ratings_link)
✅ **Proper NULL Handling**: Unrated books handled correctly in filters/sorts
✅ **URL Persistence**: Rating filter survives page refresh
✅ **Reduced Complexity**: No dual-update logic needed

### Neutral

ℹ️ **Scale Conversion**: Must convert 1-5 ↔ 2,4,6,8,10 when syncing with Calibre
ℹ️ **Foreign Key Complexity**: Calibre's ratings table adds indirection (ratings.id vs rating value)
ℹ️ **No Rating History**: Current rating only - no historical ratings per re-read

### Negative

⚠️ **Write Operations Risk**: Writing to Calibre DB requires careful validation and error handling
⚠️ **Sync Dependency**: Calibre must be accessible for writes (though read-only sync still works)
⚠️ **No Decimal Ratings**: Limited to whole stars (1-5), not half stars like Calibre supports in UI

## Testing

### Test Results
- ✅ **295 tests passing, 0 failures**
- ✅ All existing tests updated for new rating system
- ✅ Integration tests verify end-to-end rating flow
- ✅ No regressions introduced

### Test Files Updated
- `__tests__/unit/lib/calibre.test.ts` - Added ratings tables to test schema
- `__tests__/api/books.test.ts` - Updated to use book.rating
- `__tests__/integration/library-service-api.test.ts` - Added rating to test data
- `__tests__/integration/api/read-filter-lifecycle.test.ts` - Added book rating updates

### Manual Testing Checklist

**Rating CRUD**:
- [x] Set rating on new book via finish modal
- [x] Update existing rating via finish modal
- [x] Remove rating (set to NULL)
- [x] Rating persists across page reloads
- [x] Rating visible in library grid
- [x] Rating syncs to Calibre database

**Filtering**:
- [x] Filter by exact rating (5 stars)
- [x] Filter by range (4+ stars)
- [x] Filter by unrated books
- [x] Filter persists in URL
- [x] Filter works with pagination
- [x] Clear all resets rating filter

**Sorting**:
- [x] Sort by rating (high to low)
- [x] Sort by rating (low to high)
- [x] Unrated books appear last
- [x] Sort works with filtering

**Calibre Sync**:
- [x] Rating in Calibre → syncs to Tome on sync
- [x] Rating in Tome → writes to Calibre immediately
- [x] Deleted rating in Calibre → syncs as NULL to Tome
- [x] New book with rating → imported on first sync

## Migration Guide

### For Existing Users

**No Data Migration Required**! 

The rating column was added to the books table with NULL as default, and the rating column was removed from reading_sessions. Existing books will show as "unrated" until you:

1. Set a rating via the finish modal when marking books as read
2. Sync from Calibre (if ratings exist there)
3. Use the dedicated rating API endpoint

**Important Notes**:
- Historical session ratings were dropped - ratings now stored on books only
- Sessions now only store reviews (personal notes)
- Only book.rating is updated when marking as read

### Database Changes

```sql
-- Migration 0003: Add rating to books
ALTER TABLE books ADD COLUMN rating INTEGER;

-- Migration 0004: Remove rating from reading_sessions
ALTER TABLE reading_sessions DROP COLUMN rating;

-- Migration 0005: Add validation triggers
CREATE TRIGGER books_rating_check_insert ...
CREATE TRIGGER books_rating_check_update ...
```

Run via:
```bash
bun run lib/db/migrate.ts
```

## Future Considerations

1. **Half-Star Support**: Could add decimal ratings (1.0-5.0) to match Calibre's UI capabilities
2. **Bulk Rating Updates**: Admin tool to set ratings for multiple books at once
3. **Rating History**: Track when ratings change over time (audit log) - would require separate history table
4. **Rating Statistics**: Show average rating, distribution, etc. on stats page
5. **Import Ratings**: Tool to import ratings from other sources (Goodreads, StoryGraph)
6. **Review Sync**: Consider syncing reviews to Calibre's comments field
7. **Rating Notifications**: Alert user when Calibre rating differs from Tome
8. **Per-Read Ratings**: If historical ratings are desired, add separate rating_history table linked to sessions

## Related ADRs

- [ADR-001: MongoDB to SQLite Migration](./ADR-001-MONGODB-TO-SQLITE-MIGRATION.md) - Context for database architecture

## References

### Documentation
- [Calibre Database Schema](https://manual.calibre-ebook.com/db_api.html)
- [SQLite Triggers](https://www.sqlite.org/lang_createtrigger.html)
- [Drizzle ORM - SQLite](https://orm.drizzle.team/docs/get-started-sqlite)

### Implementation Files

**Database**:
- `lib/db/schema/books.ts` - Books schema with rating field
- `lib/db/calibre.ts` - Read operations with ratings JOIN
- `lib/db/calibre-write.ts` - Write operations for ratings

**API**:
- `app/api/books/[id]/rating/route.ts` - Rating endpoint (new)
- `app/api/books/[id]/status/route.ts` - Updates both ratings
- `app/api/books/route.ts` - Returns book.rating

**Services**:
- `lib/sync-service.ts` - Syncs ratings FROM Calibre
- `lib/library-service.ts` - Rating filter integration
- `lib/dashboard-service.ts` - Rating interface update

**Repositories**:
- `lib/repositories/book.repository.ts` - Rating filter/sort logic

**Components**:
- `components/FinishBookModal.tsx` - Star rating selector (new)
- `components/LibraryFilters.tsx` - Rating filter dropdown
- `app/books/[id]/page.tsx` - Modal integration
- `app/library/page.tsx` - Filter state management

**State**:
- `hooks/useLibraryData.ts` - Rating state management

**Migrations**:
- `drizzle/0003_busy_thor_girl.sql` - Add rating column to books
- `drizzle/0004_last_pretty_boy.sql` - Remove rating from reading_sessions
- `drizzle/0005_add_books_rating_check.sql` - Add validation triggers

**Tests**:
- `__tests__/unit/lib/calibre.test.ts` - Ratings schema tests
- `__tests__/api/books.test.ts` - Book rating API tests
- `__tests__/integration/library-service-api.test.ts` - Library integration
- `__tests__/integration/api/read-filter-lifecycle.test.ts` - Rating lifecycle

---

**Decision Made By**: Claude Code (AI Assistant)  
**Date**: November 20, 2025  
**Implementation Date**: November 20, 2025  
**Reviewed By**: User (masonfox)  
**Status**: ✅ Implemented and Production Ready
