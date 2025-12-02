# ADR-007: Layered Cache Invalidation Strategy

## Status
✅ **Implemented** - December 1, 2025

## Context

Tome uses Next.js App Router, which implements multiple caching layers that can cause stale data issues. When users perform mutations (logging progress, changing book status, updating ratings), the changes need to be reflected immediately across all pages, especially the dashboard.

### The Problem: Multi-Layer Caching

Next.js App Router uses **three distinct cache layers**:

1. **Server-side Data Cache** - Caches fetch() responses and database queries on the server
2. **Full Route Cache** - Caches the RSC payload and HTML for static/dynamic routes
3. **Client-side Router Cache** - In-memory cache on the client for visited routes

**Bug Scenario**: User logs progress on a book detail page, then navigates to dashboard:
- Server-side cache gets invalidated via `revalidatePath('/')` ✓
- But client-side router cache still has stale dashboard data ✗
- Dashboard shows outdated progress/streak information until hard refresh

### Why This Happened

Previous fixes (PR #42, PR #48) added `revalidatePath('/')` calls to invalidate the **server cache**, but didn't address the **client-side router cache**. This created a whack-a-mole problem where each new mutation endpoint needed manual cache invalidation.

### Requirements

1. **Always Fresh Data**: Dashboard and stats pages must always show current data
2. **Scalable**: No need to remember to add cache busting to every new mutation
3. **Performance**: Minimize unnecessary re-fetching for pages that don't change often
4. **Clear Architecture**: Cache strategy should be obvious from code structure

## Decision

We implement a **layered cache invalidation strategy** combining:

### 1. Service Layer: Comprehensive Path Revalidation

Services handle **server-side cache invalidation** for all affected pages:

```typescript
// lib/services/progress.service.ts
private async invalidateCache(bookId: number): Promise<void> {
  revalidatePath("/");                // Dashboard
  revalidatePath("/library");         // Library page
  revalidatePath("/stats");           // Stats page
  revalidatePath(`/books/${bookId}`); // Book detail page
}

// lib/services/session.service.ts
private async invalidateCache(bookId: number): Promise<void> {
  revalidatePath("/");                // Dashboard
  revalidatePath("/library");         // Library page
  revalidatePath("/stats");           // Stats page
  revalidatePath(`/books/${bookId}`); // Book detail page
}
```

**Why Services?** 
- Single source of truth for cache invalidation
- All mutation methods automatically invalidate cache
- API routes that call services don't need to handle caching

### 2. Page Layer: Disable Router Cache for Critical Pages

For pages that aggregate frequently-changing data, disable **client-side router cache**:

```typescript
// app/page.tsx (Dashboard)
export const dynamic = 'force-dynamic';
export const revalidate = 0; // Disable all caching including router cache

// app/stats/page.tsx
export const dynamic = 'force-dynamic';
export const revalidate = 0; // Disable all caching including router cache
```

**What `revalidate = 0` does:**
- Disables server-side Full Route Cache
- Disables client-side Router Cache
- Forces fresh fetch on every navigation
- Works automatically - no manual `router.refresh()` needed

### 3. API Routes: Trust Service Layer

API routes **defer to service layer** for cache invalidation:

```typescript
// app/api/books/[id]/progress/route.ts
const progressLog = await progressService.logProgress(bookId, progressData);
// Note: Cache invalidation handled by ProgressService.invalidateCache()
return NextResponse.json(progressLog);
```

**Why remove duplicate `revalidatePath()`?**
- Services already handle invalidation comprehensively
- Reduces code duplication
- Single place to update cache strategy
- Clear intent: look at service to understand cache behavior

**Exception:** Keep `revalidatePath()` in API routes where service doesn't handle it (e.g., rating endpoint using BookService without cache invalidation method).

## Implementation Details

### Which Pages Use `revalidate = 0`

**Dashboard (`/`)**: YES
- Aggregates: books, progress, streaks, stats
- Changes frequently with any user action
- Primary user landing page

**Stats (`/stats`)**: YES  
- Aggregates: reading stats, activity data
- Depends on progress logs and session data
- Should always show current metrics

**Library (`/library`)**: NO
- List view with filters
- Server-side cache invalidation sufficient
- Acceptable to show slightly stale data during navigation

**Book Detail (`/books/[id]`)**: NO
- Single book data
- Server-side cache invalidation sufficient  
- Page itself triggers mutations, so always refetches after own changes

### Cache Invalidation Flow

**Example: User logs progress on book detail page**

1. **Client**: User submits progress form
2. **API**: `POST /api/books/123/progress`
3. **Service**: `progressService.logProgress(123, data)`
   - Creates progress entry
   - Updates session timestamp
   - Rebuilds streak
   - **Calls `invalidateCache(123)`** → revalidates `/`, `/library`, `/stats`, `/books/123`
4. **API**: Returns success response
5. **Client**: User navigates to dashboard
6. **Router**: Detects `revalidate = 0` on dashboard → **bypasses client cache**
7. **Server**: Fetches fresh data (server cache already invalidated in step 3)
8. **Client**: Dashboard renders with updated progress/streak ✓

## Consequences

### Positive

✅ **Scalable**: New mutations automatically work without manual cache busting  
✅ **Predictable**: Clear where caching behavior is defined (services + page config)  
✅ **No Whack-a-Mole**: Don't need to remember to add cache invalidation to each new endpoint  
✅ **Self-Documenting**: `revalidate = 0` clearly signals "this page always fetches fresh"  
✅ **Minimal Performance Impact**: Only dashboard and stats bypass router cache

### Negative

⚠️ **Slightly More Fetching**: Dashboard/stats always fetch on navigation (but acceptable for these critical pages)  
⚠️ **Service Dependency**: API routes must use services to get cache invalidation (but this is good architecture anyway)

### Trade-offs

**Why not use `revalidate = 0` everywhere?**
- Book detail pages can use router cache since they refetch after their own mutations
- Library page list view doesn't change frequently enough to need it
- Better performance for pages that don't aggregate data from multiple sources

**Why not use `router.refresh()` in hooks?**
- Requires remembering to add it to every mutation hook
- Spreads cache logic across many files
- Easy to miss when adding new features
- Page-level `revalidate = 0` is more maintainable

## Future Considerations

### If Performance Becomes a Concern

Could add **short-lived caching** to dashboard:

```typescript
export const revalidate = 30; // Cache for 30 seconds
```

With proper `revalidatePath()` calls in services, this would provide:
- Fresh data on mutations (services invalidate)
- Cached data for quick navigation (30 second window)
- Best of both worlds

### If More Pages Need Aggregation

Follow this pattern:
1. Does page aggregate data from multiple sources? → Use `revalidate = 0`
2. Does page change frequently? → Use `revalidate = 0`
3. Is page a critical user landing page? → Use `revalidate = 0`
4. Otherwise → Use server-side cache invalidation only

### Monitoring Cache Behavior

Consider adding logging to understand cache patterns:

```typescript
// Middleware or instrumentation
logger.info({
  route: '/dashboard',
  cacheHit: false,
  reason: 'revalidate=0'
});
```

## References

- [Next.js Caching Documentation](https://nextjs.org/docs/app/building-your-application/caching)
- [Next.js revalidatePath API](https://nextjs.org/docs/app/api-reference/functions/revalidatePath)
- [Next.js Route Segment Config](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config)
- PR #42: Fix dashboard streak not refreshing after logging progress
- PR #48: Fix dashboard not updating after book status and rating changes

## Related ADRs

- ADR-004: Backend Service Layer Architecture - Defines service responsibilities
- ADR-006: Timezone-Aware Date Handling - Affects what "fresh data" means for dates

## Code Locations

**Service Layer Cache Invalidation:**
- `lib/services/progress.service.ts:339-348` - ProgressService.invalidateCache()
- `lib/services/session.service.ts:270-281` - SessionService.invalidateCache()

**Page Layer Cache Configuration:**
- `app/page.tsx:8-9` - Dashboard with revalidate = 0
- `app/stats/page.tsx:12-13` - Stats with revalidate = 0

**API Routes:**
- `app/api/books/[id]/progress/route.ts` - Defers to service
- `app/api/books/[id]/progress/[progressId]/route.ts` - Defers to service
- `app/api/books/[id]/status/route.ts` - Defers to service
- `app/api/books/[id]/reread/route.ts` - Defers to service
- `app/api/books/[id]/rating/route.ts` - Keeps revalidatePath (BookService doesn't invalidate)
