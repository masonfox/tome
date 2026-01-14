# Plan: Cache Bust Covers (Issue #268)

**Issue**: https://github.com/masonfox/tome/issues/268  
**Created**: 2026-01-13  
**Status**: In Progress - Phase 3 Complete

---

## Context

### Problem Statement
Tome's current cover caching strategy is too aggressive:
- **Browser cache**: 1 year + `immutable` directive → covers never refresh
- **Server cache**: 24-hour TTL → stale covers for up to a day
- **No cache invalidation**: Calibre sync doesn't clear cover caches
- **No cache busting**: URLs don't include version/timestamp parameters

### Real-World Scenario
Users running both Tome and Calibre-Web (or Calibre directly) may update book covers in their Calibre library:
1. User updates cover in Calibre or Calibre-Web
2. Tome's server cache shows old cover for up to 24 hours
3. User's browser cache shows old cover indefinitely (requires hard refresh)
4. No way to manually force refresh

### Why This Matters
From constitution:
> **II. Respect Calibre as Source of Truth**  
> Calibre is the user's primary book library. Tome tracks reading; Calibre manages books.

Tome should reflect the current state of the Calibre library, including covers.

---

## Current Implementation

### Cover API Routes
- `/app/api/books/[id]/cover/route.ts` - Primary endpoint (244 lines)
- `/app/api/covers/[...path]/route.ts` - Alternative (245 lines, identical implementation)

### Caching Architecture (Two-Tier)
```typescript
// Server-side in-memory LRU caches
CoverCache:
  - Max size: 500 images
  - TTL: 24 hours
  - Stores: image buffers + content type

BookPathCache:
  - Max size: 1000 paths
  - TTL: 1 hour
  - Stores: Calibre book path + has_cover flag
```

### HTTP Cache Headers (Aggressive)
```http
Cache-Control: public, max-age=31536000, immutable
X-Cache: HIT|MISS
```

### Current Cover Usage (14 components)
- `BookHeader.tsx` - Detail page
- `BookTable.tsx` - Library table
- `BookCard.tsx` - Grid view
- `BookListItem.tsx` - List view
- `FannedBookCovers.tsx` - Dashboard
- `CurrentlyReadingList.tsx` - Dashboard
- `TagDetailPanel.tsx` - Tag view
- And 7 more...

**Pattern**: All use `src={/api/books/${book.calibreId}/cover}`

---

## Solution Design

### Strategy: Timestamp-Based Cache Busting
Append `lastSynced` timestamp to cover URLs to force browser refresh after Calibre sync.

### Benefits
✅ Leverages existing `lastSynced` field (no new database columns)  
✅ Simple, transparent mechanism  
✅ Works with browser cache (URL changes = fresh fetch)  
✅ Automatic: triggers on every Calibre sync  
✅ Minimal performance impact  
✅ No breaking changes to API contracts

### Architecture Changes
```
User updates cover in Calibre
  ↓
Calibre file watcher detects change (2s debounce)
  ↓
Sync service runs (updates books, sets lastSynced)
  ↓
Server-side caches cleared
  ↓
Frontend URLs now include ?t=<lastSynced>
  ↓
Browser sees new URL → fresh fetch
  ↓
Server cache miss → reads from filesystem
  ↓
New cover displayed
```

---

## Implementation Plan

### Phase 1: Server-Side Cache Invalidation
**Goal**: Clear server caches during Calibre sync

#### Task 1.1: Export cache clear methods ✅
**File**: `app/api/books/[id]/cover/route.ts`
- Export `clearCoverCache()` function
- Export `clearBookPathCache()` function
- Maintain existing cache classes (no refactor needed)

**Changes**:
```typescript
// At end of file (after GET handler)
export function clearCoverCache(): void {
  coverCache.clear();
}

export function clearBookPathCache(): void {
  bookPathCache.clear();
}
```

**Rationale**: Follow Repository Pattern principle - encapsulate cache management, don't expose internals.

---

#### Task 1.2: Clear caches during sync ✅
**File**: `lib/sync-service.ts`

**Changes**:
```typescript
import { clearCoverCache, clearBookPathCache } from "@/app/api/books/[id]/cover/route";

export async function syncCalibreLibrary(...) {
  // ... existing sync logic ...
  
  try {
    // Before returning success
    clearCoverCache();
    clearBookPathCache();
    
    logger.info("Cleared cover caches after sync");
    
    return {
      success: true,
      syncedCount,
      updatedCount,
      // ...
    };
  } finally {
    isSyncing = false;
  }
}
```

**Rationale**: Sync is the canonical moment when book data (including covers) may have changed in Calibre.

---

### Phase 2: Reduce Browser Cache Duration
**Goal**: Balance performance with freshness

#### Task 2.1: Update Cache-Control headers ✅
**File**: `app/api/books/[id]/cover/route.ts`

**Current**:
```typescript
"Cache-Control": "public, max-age=31536000, immutable"
```

**New**:
```typescript
"Cache-Control": "public, max-age=604800" // 1 week
```

**Rationale**: 
- Remove `immutable` (indicates content can change)
- Reduce from 1 year to 1 week
- Still aggressive enough for performance
- Short enough for reasonable freshness expectations
- Calibre sync + URL versioning will override anyway

**Apply to**:
- Cover cache HIT response (line 150)
- Cover cache MISS response (line 235)
- Placeholder image response (line 118)

---

### Phase 3: URL-Based Cache Busting
**Goal**: Force browser refresh after sync via URL changes

#### Task 3.1: Create cover URL utility ✅
**File**: `lib/utils/cover-url.ts` (new file)

```typescript
/**
 * Generates a cache-busted cover URL for a book
 * 
 * Appends lastSynced timestamp as query param to force browser
 * cache invalidation when covers change in Calibre
 * 
 * @param calibreId - Calibre book ID
 * @param lastSynced - Last sync timestamp (optional)
 * @returns Cover URL with cache busting param
 * 
 * @example
 * getCoverUrl(123) // "/api/books/123/cover"
 * getCoverUrl(123, new Date()) // "/api/books/123/cover?t=1705161600000"
 */
export function getCoverUrl(
  calibreId: number,
  lastSynced?: Date | string | null
): string {
  const baseUrl = `/api/books/${calibreId}/cover`;
  
  if (!lastSynced) {
    return baseUrl;
  }
  
  const timestamp = typeof lastSynced === 'string' 
    ? new Date(lastSynced).getTime() 
    : lastSynced.getTime();
  
  return `${baseUrl}?t=${timestamp}`;
}
```

**Rationale**:
- Centralized logic (DRY principle)
- Type-safe with TypeScript
- Graceful fallback (no timestamp = no param)
- Clear JSDoc for maintainability

---

#### Task 3.2: Update all components to use utility ✅
**Files**: 12 component files (see "Current Cover Usage" section)

**Pattern** (repeat for all 14 files):
```typescript
// Add import
import { getCoverUrl } from "@/lib/utils/cover-url";

// Replace direct URL
- src={`/api/books/${book.calibreId}/cover`}
+ src={getCoverUrl(book.calibreId, book.lastSynced)}
```

**Component List**:
1. ✅ `components/BookDetail/BookHeader.tsx` (line 125)
2. ✅ `components/Books/BookTable.tsx` (line 225)
3. ✅ `components/Books/BookCard.tsx` (line 43)
4. ✅ `components/Books/BookListItem.tsx` (line 96)
5. ✅ `components/Books/DraggableBookTable.tsx` (line 147)
6. ✅ `components/Utilities/FannedBookCovers.tsx` (line 170) - *No lastSynced available, benefits from reduced cache duration*
7. ✅ `components/CurrentlyReading/CurrentlyReadingList.tsx` (line 69)
8. ✅ `components/TagManagement/TagDetailPanel.tsx` (line 79)
9. ✅ `components/TagManagement/TagDetailBottomSheet.tsx` (line 83)
10. ✅ `components/ShelfManagement/AddBooksToShelfModal.tsx` (line 413)
11. ✅ `app/journal/page.tsx` (line 416)
12. ✅ `app/series/[name]/page.tsx` (line 115)

**Rationale**: Consistent application of cache busting across entire UI.

---

#### Task 3.3: Update API route to ignore query param ✅
**File**: `app/api/books/[id]/cover/route.ts`

**Change**: No code changes needed! 
- Next.js already ignores unrecognized query params
- `?t=123456` will be ignored by handler
- Cache key still uses `bookId` only

**Verification**: Add comment documenting behavior
```typescript
export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  // NOTE: Query params like ?t=<timestamp> are used for cache busting on the client
  // but are intentionally ignored by the server. The server caches by bookId only.
  const params = await props.params;
  // ...
}
```

---

### Phase 4: Manual Cache Clear API (Optional Enhancement)
**Goal**: Provide manual cache control for debugging/power users

#### Task 4.1: Create cache management endpoint ⬜
**File**: `app/api/cache/clear/route.ts` (new file)

```typescript
import { clearCoverCache, clearBookPathCache } from "@/app/api/books/[id]/cover/route";
import { NextResponse } from "next/server";
import { getLogger } from "@/lib/logger";

/**
 * POST /api/cache/clear
 * 
 * Clears all server-side cover caches
 * Useful for debugging or forcing immediate refresh
 */
export async function POST() {
  try {
    clearCoverCache();
    clearBookPathCache();
    
    getLogger().info("Manual cache clear triggered");
    
    return NextResponse.json({ 
      success: true,
      message: "Cover caches cleared",
      clearedAt: new Date().toISOString()
    });
  } catch (error) {
    getLogger().error({ err: error }, "Failed to clear caches");
    return NextResponse.json(
      { error: "Failed to clear caches" },
      { status: 500 }
    );
  }
}
```

**Rationale**: 
- Developer debugging tool
- Power user manual override
- Follows RESTful conventions (POST = action)
- Safe (no destructive side effects)

---

#### Task 4.2: Add cache stats endpoint ⬜
**File**: `app/api/cache/stats/route.ts` (new file)

```typescript
import { getCoverCacheStats, getBookPathCacheStats } from "@/app/api/books/[id]/cover/route";
import { NextResponse } from "next/server";

/**
 * GET /api/cache/stats
 * 
 * Returns cache statistics for monitoring
 */
export async function GET() {
  const stats = {
    coverCache: getCoverCacheStats(),
    bookPathCache: getBookPathCacheStats(),
    timestamp: new Date().toISOString()
  };
  
  return NextResponse.json(stats);
}
```

**Requires**: Export stats methods from cover route
```typescript
export function getCoverCacheStats() {
  return {
    size: coverCache.getSize(),
    maxSize: CACHE_CONFIG.COVER_CACHE.MAX_SIZE,
    maxAgeMs: CACHE_CONFIG.COVER_CACHE.MAX_AGE_MS
  };
}

export function getBookPathCacheStats() {
  return {
    size: bookPathCache.getSize(),
    maxSize: CACHE_CONFIG.BOOK_PATH_CACHE.MAX_SIZE,
    maxAgeMs: CACHE_CONFIG.BOOK_PATH_CACHE.MAX_AGE_MS
  };
}
```

**Rationale**: Observability for cache performance.

---

### Phase 5: Testing
**Goal**: Ensure cache busting works correctly

#### Task 5.1: Unit tests for cover URL utility ⬜
**File**: `__tests__/lib/utils/cover-url.test.ts` (new file)

**Test cases**:
1. Returns base URL when no lastSynced provided
2. Appends timestamp when Date object provided
3. Handles string date format
4. Handles null lastSynced
5. Uses correct timestamp format (milliseconds)
6. Includes calibreId in URL

---

#### Task 5.2: Integration test for cache clearing ⬜
**File**: `__tests__/lib/sync-service.cache-clear.test.ts` (new file)

**Test cases**:
1. Sync clears cover cache
2. Sync clears book path cache
3. Cache cleared even if sync partially fails
4. Cache statistics update after clear

---

#### Task 5.3: Update existing component tests ⬜
**Files**: `__tests__/components/BookHeader.test.tsx` (and others using covers)

**Change**:
```typescript
- expect(image).toHaveAttribute("src", expect.stringContaining("/api/books/1/cover"));
+ expect(image).toHaveAttribute("src", expect.stringContaining("/api/books/1/cover"));
+ // May include cache busting param like ?t=1705161600000
```

**Rationale**: Tests should be resilient to cache busting params.

---

#### Task 5.4: Manual testing checklist ⬜
1. ✅ Covers display correctly (no regressions)
2. ✅ Server cache HIT/MISS headers correct
3. ✅ Sync clears server cache (check logs)
4. ✅ URL includes timestamp after sync
5. ✅ Browser fetches new cover after sync
6. ✅ Placeholder image still works
7. ✅ Cache stats API returns correct data
8. ✅ Manual cache clear API works

---

## Configuration Changes

No environment variables or configuration needed. All changes use existing fields (`lastSynced`).

---

## Rollout Strategy

### Deployment Steps
1. Deploy Phase 1 (server cache clearing during sync)
2. Deploy Phase 2 (reduced browser cache)
3. Deploy Phase 3 (URL cache busting)
4. Deploy Phase 4 (optional cache management APIs)

### Rollback Plan
If issues arise:
1. Revert Phase 3 (remove getCoverUrl utility usage)
2. Browser cache will continue to use reduced max-age (Phase 2)
3. Server cache clearing (Phase 1) is safe to keep

### Monitoring
- Check logs for "Cleared cover caches after sync" message
- Monitor `/api/cache/stats` for cache hit rates
- Watch for increased filesystem I/O (expected short-term)

---

## Performance Impact

### Expected Changes
**Server-side**:
- ✅ No change to cache storage (still 500 images)
- ✅ Sync time +1ms (two clear() operations)
- ⚠️ More cache misses immediately after sync (expected)

**Client-side**:
- ✅ No change to initial load
- ✅ Query param adds ~15 bytes per URL
- ✅ Fresh covers after sync (feature, not bug)

**Network**:
- ⚠️ Increased bandwidth immediately after sync (users re-fetch covers)
- ✅ Overall reduction in bandwidth (1 week vs 1 year cache)

---

## Risks and Mitigations

### Risk 1: Increased server load after sync
**Impact**: All users refresh covers simultaneously  
**Likelihood**: Medium  
**Mitigation**: Server cache will warm up quickly; consider staggered cache clearing in future

### Risk 2: Missing lastSynced values
**Impact**: Some books may not cache bust  
**Likelihood**: Low (all books get lastSynced during sync)  
**Mitigation**: Graceful fallback (no timestamp = base URL)

### Risk 3: Query param conflicts
**Impact**: Future features may use `?t=` param  
**Likelihood**: Low  
**Mitigation**: Document param usage; consider namespace like `?cache=`

---

## Alternative Approaches Considered

### ❌ Hash-Based Versioning
```typescript
// Example: /api/books/123/cover?hash=abc123
```
**Pros**: Guarantees cache bust only when file actually changes  
**Cons**: 
- Requires hashing cover files (expensive I/O)
- Would need to store hash in database
- Overkill for this use case

**Why rejected**: Too complex; timestamp is sufficient

---

### ❌ ETag Headers
```typescript
// Example: ETag: "abc123"
```
**Pros**: Standard HTTP cache validation  
**Cons**:
- Requires conditional GET support
- Client still makes request (304 response)
- Doesn't force fresh fetch

**Why rejected**: Doesn't solve the browser cache issue

---

### ❌ Cache-Control: no-cache
```typescript
"Cache-Control": "no-cache, must-revalidate"
```
**Pros**: Forces revalidation on every request  
**Cons**:
- Huge performance hit
- Defeats purpose of caching
- Server load increases dramatically

**Why rejected**: Too aggressive; breaks performance

---

### ✅ Chosen: Timestamp + Reduced max-age
**Pros**:
- Leverages existing data (lastSynced)
- Simple implementation
- Predictable behavior
- Good performance balance

**Cons**:
- May refresh covers that haven't changed
- Relies on sync to update lastSynced

**Why chosen**: Best balance of simplicity, performance, and correctness

---

## Success Metrics

### Definition of Done
- ✅ All 12+ components use `getCoverUrl()` utility
- ✅ Sync clears server-side caches (verified in logs)
- ✅ Browser cache duration reduced to 1 week
- ✅ Cover URLs include `?t=<timestamp>` when lastSynced exists
- ✅ All tests pass (unit + integration)
- ✅ Manual testing checklist complete

### User-Facing Improvements
1. Covers refresh automatically after Calibre sync
2. No hard refresh (Ctrl+F5) needed
3. Consistent experience across Tome and Calibre-Web

### Technical Improvements
1. Server cache invalidation on sync
2. Centralized cover URL generation
3. Optional cache management APIs
4. Better observability (cache stats)

---

## Timeline Estimate

**Phase 1** (Server cache clearing): 1 hour  
**Phase 2** (Browser cache headers): 30 minutes  
**Phase 3** (URL cache busting): 2 hours  
**Phase 4** (Optional APIs): 1 hour  
**Phase 5** (Testing): 2 hours  

**Total**: 6.5 hours

---

## Open Questions

1. **Should we clear caches on partial sync failures?**  
   → Recommendation: Yes, use try/finally to ensure clearing

2. **Should we add cache warming after clearing?**  
   → Recommendation: No, let natural traffic warm cache

3. **Should timestamp be milliseconds or seconds?**  
   → Recommendation: Milliseconds (JavaScript Date.getTime() standard)

4. **Should we also update the `/api/covers/[...path]` route?**  
   → Recommendation: Yes for consistency, but it's rarely used (check usage first)

---

## References

- **Issue**: https://github.com/masonfox/tome/issues/268
- **Constitution**: `.specify/memory/constitution.md` (Principle II: "Respect Calibre as Source of Truth")
- **Patterns**: `.specify/memory/patterns.md` (Pattern 7: Sync Service)
- **Calibre-Web**: https://github.com/janeczku/calibre-web (Related tool users may be running)

---

## Approval Status

- [ ] Approach aligns with constitution principles
- [ ] Pattern follows existing sync service patterns
- [ ] No new external dependencies
- [ ] Performance impact acceptable
- [ ] Rollback plan documented
- [ ] Testing strategy comprehensive
- [ ] Ready for implementation
