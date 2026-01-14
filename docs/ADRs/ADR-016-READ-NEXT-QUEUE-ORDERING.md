# ADR-016: Read-Next Queue Ordering

**Status:** Accepted  
**Date:** 2026-01-14  
**Deciders:** Mason Bartle (via AI assistant)  
**Issue:** #271

---

## Context

Users can now reorder books on shelves (#185), but "read-next" status books cannot be sorted. This creates an inconsistent experience - users can organize their shelves but not their reading queue. Additionally, there's no dedicated page for managing the read-next queue, forcing users to filter the library page.

**User Pain Points:**
1. No way to prioritize which read-next books to read first
2. Must use Library page with filters (indirect access)
3. Inconsistent with shelves feature (which has drag-and-drop)
4. No dedicated view for read-next queue management

**Design Goals:**
1. Provide custom ordering for read-next books
2. Create dedicated `/read-next` page (mirroring `/shelves/[id]`)
3. Maintain clean database state (no gaps in ordering)
4. Support mobile and desktop drag-and-drop
5. Keep API efficient (batch operations)

---

## Decision

We will implement **Approach 1: Dedicated Read-Next Order Column** with automatic gap compaction.

### Core Approach

Add a `read_next_order` column to `reading_sessions` table with the following characteristics:

1. **Default value:** 0 (for all non-read-next books)
2. **Sequential ordering:** 0, 1, 2, 3... (no gaps)
3. **Auto-assignment:** When entering read-next status, assign next available order
4. **Auto-compaction:** When leaving read-next status, renumber remaining books
5. **Partial index:** Only index WHERE status='read-next' (performance)

### Schema Changes

```sql
-- Migration: drizzle/0019_kind_smiling_tiger.sql
ALTER TABLE reading_sessions ADD COLUMN read_next_order INTEGER DEFAULT 0 NOT NULL;
CREATE INDEX idx_sessions_read_next_order 
  ON reading_sessions(read_next_order, id) 
  WHERE status = 'read-next';
```

### Companion Migration

```typescript
// lib/migrations/0019_initialize_read_next_order.ts
// Initializes existing read-next books with sequential order
// Based on updated_at DESC (most recent first)
export async function up(db: Database) {
  const readNextSessions = db.prepare(`
    SELECT id FROM reading_sessions 
    WHERE status = 'read-next' 
    ORDER BY updated_at DESC
  `).all();

  const updateStmt = db.prepare(
    'UPDATE reading_sessions SET read_next_order = ? WHERE id = ?'
  );

  readNextSessions.forEach((session, index) => {
    updateStmt.run(index, session.id);
  });
}
```

### Auto-Compaction Logic

**Triggered in:** `sessionService.updateStatus()`

**On entry to read-next:**
1. Call `getNextReadNextOrder()` → returns max + 1
2. Set `readNextOrder` to returned value
3. Call `reindexReadNextOrders()` to ensure clean state

**On exit from read-next:**
1. Reset `readNextOrder` to 0
2. Call `reindexReadNextOrders()` to renumber remaining books

**Example:**
```
Initial: [A: 0] [B: 1] [C: 2] [D: 3]
Book B changes to "reading":
  → B.readNextOrder = 0
  → reindexReadNextOrders()
Final:   [A: 0] [C: 1] [D: 2]
```

### API Design

**GET /api/sessions/read-next** (fetch all read-next books)
- Query params: `search` (optional)
- Returns: Sessions sorted by `readNextOrder ASC`

**PUT /api/sessions/read-next/reorder** (batch reorder)
- Body: `{ updates: Array<{ id: number, readNextOrder: number }> }`
- Validation: Zod schema
- Transaction: All updates in single DB transaction

### Frontend Architecture

**Page → Hook → Service → API → Repository**

1. **Page:** `app/read-next/page.tsx` (~200 lines)
   - Drag-and-drop reordering
   - Search with 300ms debounce
   - Bulk selection and removal
   - Empty state with CTA

2. **Hook:** `hooks/useReadNextBooks.ts`
   - React Query for data fetching
   - Optimistic updates on drag
   - Cache invalidation on mutations

3. **Navigation:** 
   - Add link after Library, before Shelves
   - Update dashboard card to link to `/read-next`

---

## 10 Key Design Decisions

### 1. Default Ordering Behavior
**Decision:** Append to end  
**Rationale:** Natural queue behavior - new items go to back of line  
**Alternative rejected:** Prepend to top (requires shifting all existing orders)

### 2. Order Persistence
**Decision:** Reset + auto-compact on exit  
**Rationale:** Keeps database clean, prevents unbounded growth of order values  
**Alternative rejected:** Preserve order permanently (clutters DB with stale values)

### 3. Sort Fallback
**Decision:** Custom order only (v1)  
**Rationale:** Keep simple for initial release, add more sorts later if needed  
**Alternative rejected:** Multiple sort options (title, author, added date)

### 4. Bulk Actions
**Decision:** Remove only (change status to "to-read")  
**Rationale:** Most common action, other status changes done via book detail page  
**Alternative rejected:** All status transitions (complex UI, rare use case)

### 5. API Design
**Decision:** Batch reorder only (single endpoint)  
**Rationale:** Efficient for drag-and-drop, reduces round-trips  
**Alternative rejected:** Single-book reorder API (N API calls per drag)

### 6. Navigation Placement
**Decision:** After Library, before Shelves  
**Rationale:** Logical progression: All books → Read Next → Collections  
**Alternative rejected:** After Shelves (less prominent, read-next is high-traffic)

### 7. Dashboard Integration
**Decision:** Update existing card link to `/read-next`  
**Rationale:** Dedicated page is superior UX to filtered library  
**Alternative rejected:** Keep library link (missed opportunity for better UX)

### 8. Initial Migration Order
**Decision:** `updated_at DESC` (most recent first)  
**Rationale:** Recent activity indicates higher priority  
**Alternative rejected:** `title ASC` (alphabetical has no semantic meaning for queue)

### 9. Add Books Modal
**Decision:** Skip for now  
**Rationale:** Users already add via Library page status changes, avoid duplication  
**Alternative rejected:** In-page modal (requires search, filters, pagination - heavy lift)

### 10. Empty State CTA
**Decision:** Browse Library (`/library?status=to-read`)  
**Rationale:** Natural source of read-next candidates  
**Alternative rejected:** Link to all books (overwhelming, not targeted)

---

## Consequences

### Positive

✅ **Consistent UX:** Matches shelves feature (drag-and-drop reordering)  
✅ **Clean database:** Auto-compaction prevents gaps, keeps orders sequential  
✅ **Efficient API:** Batch reorder reduces server load  
✅ **Dedicated page:** Better UX than filtered library view  
✅ **Optimistic updates:** Instant feedback with React Query  
✅ **Mobile-friendly:** Touch-based drag-and-drop works smoothly  
✅ **Testable:** Repository pattern enables isolated unit tests (30 new tests)  
✅ **Performance:** Partial index only on read-next books (minimal overhead)  

### Negative

⚠️ **Auto-compaction cost:** O(n) renumbering on every status change (acceptable for typical queue size <50)  
⚠️ **Additional column:** +4 bytes per session (negligible with SQLite)  
⚠️ **No multi-sort:** v1 only supports custom order (can add later)  
⚠️ **Manual adding:** No in-page "Add Books" modal (acceptable - use Library)  

### Neutral

🔄 **Order reset on exit:** Requires rebuild if user re-adds book (intentional design)  
🔄 **Partial index:** Only works when status='read-next' (exactly what we want)  

---

## Implementation Summary

**Phases completed:**
1. ✅ Database schema + migration + companion
2. ✅ Repository layer (3 new methods + 10 tests)
3. ✅ Service layer (auto-compaction logic + 9 tests)
4. ✅ API routes (2 endpoints + 11 tests)
5. ✅ Frontend (page + hook + navigation)
6. ✅ Testing (30 new tests, 3102 total passing)
7. 🚧 Documentation (this ADR + patterns + architecture)

**Files created:**
- `drizzle/0019_kind_smiling_tiger.sql` (schema migration)
- `lib/migrations/0019_initialize_read_next_order.ts` (companion)
- `app/api/sessions/read-next/route.ts` (GET endpoint)
- `app/api/sessions/read-next/reorder/route.ts` (PUT endpoint)
- `hooks/useReadNextBooks.ts` (React Query hook)
- `app/read-next/page.tsx` (dedicated page ~200 lines)
- `__tests__/repositories/session.repository.read-next.test.ts` (10 tests)
- `__tests__/services/session.service.read-next.test.ts` (9 tests)
- `__tests__/api/sessions-read-next.test.ts` (5 tests)
- `__tests__/api/sessions-read-next-reorder.test.ts` (6 tests)

**Files modified:**
- `lib/db/schema/reading-sessions.ts` (added readNextOrder column)
- `lib/repositories/session.repository.ts` (3 new methods)
- `lib/services/session.service.ts` (auto-compaction in updateStatus)
- `lib/navigation-config.ts` (added READ_NEXT_LINK)
- `app/page.tsx` (dashboard card link)

**Pattern documented:** Pattern 12 in `.specify/memory/patterns.md`

**Test coverage:** 30 new tests, 3102 total passing

---

## Alternatives Considered

### Approach 2: Polymorphic Sort Order Column

**Idea:** Reuse `updated_at` or add generic `sort_order` column for ALL statuses

**Rejected because:**
- ❌ `sort_order` applies to all statuses (wastes space for 4 other statuses)
- ❌ No semantic meaning for "to-read" or "reading" ordering
- ❌ Index can't be partial (performance hit)
- ❌ Less clear intent than `read_next_order`

### Approach 3: Separate `read_next_queue` Table

**Idea:** Junction table linking books → queue with separate order column

**Rejected because:**
- ❌ Over-engineering for single-status ordering
- ❌ Breaks existing data model (status lives on session)
- ❌ Requires CASCADE DELETE management
- ❌ More complex queries (extra JOIN)
- ❌ Harder to maintain consistency

### Approach 4: User-Defined Sort Preferences (No DB Column)

**Idea:** Store sort order client-side (localStorage or user settings)

**Rejected because:**
- ❌ Order not preserved across devices
- ❌ Can't be used for API sorting
- ❌ Lost on cache clear or new device
- ❌ No server-side source of truth

---

## Related

- **Issue:** #271 - Read Next Queue Ordering
- **Related Issue:** #185 - Shelves feature (inspiration for drag-and-drop)
- **Pattern:** Pattern 12 in `.specify/memory/patterns.md`
- **Implementation Plan:** `docs/plans/read-next-ordering.md`
- **Constitution:** Data Integrity First (auto-compaction ensures consistency)
- **Architecture:** Layered Architecture Pattern (Route → Service → Repository)

---

## References

- [Companion Migrations Pattern](./ADR-013-COMPANION-MIGRATIONS.md)
- [Tome Patterns](../../.specify/memory/patterns.md#pattern-12-read-next-queue-ordering-with-auto-compaction)
- [React Beautiful DnD](https://github.com/atlassian/react-beautiful-dnd) (drag-and-drop library)
- [Shelves Implementation](../../app/shelves/[id]/page.tsx) (reference pattern)

---

**Approved by:** Mason Bartle  
**Implementation:** Completed 2026-01-14  
**Status:** Production-ready (pending documentation completion)
