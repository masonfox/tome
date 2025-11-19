# Database Cleanup & Orphan Book Management

## Overview

When books are removed from your Calibre library, they may become "orphaned" in the MongoDB database. This document explains the conservative cleanup strategy and how to manage orphaned books.

## Architecture: Conservative Cleanup Strategy

The system uses a **safety-first approach** to handle removed books:

1. **Detection Phase**: During sync, books in MongoDB that no longer exist in Calibre are detected
2. **Marking Phase**: These books are marked as `orphaned: true` with a timestamp, but NOT deleted
3. **User Control**: You manually decide what to do with orphaned books via API endpoints
4. **Retention**: User reading history is preserved unless explicitly deleted

### Why Conservative?

- ✅ Reading history is valuable - users may want to see past reading data
- ✅ Sync errors won't cause accidental data loss
- ✅ Books can be restored if they're re-added to Calibre
- ✅ Provides audit trail with `orphanedAt` timestamps

---

## Database Schema Changes

### Book Model Updates

Added orphan tracking fields to the `Book` schema:

```typescript
interface IBook extends Document {
  // ... existing fields ...
  orphaned?: boolean;        // Flag indicating book is no longer in Calibre
  orphanedAt?: Date;         // When the book became orphaned
}
```

**Database indexes:**
- `orphaned` index for fast filtering
- `orphanedAt` index for timestamp queries

---

## How Sync Detects Removed Books

In `lib/sync-service.ts`:

```typescript
// Track calibre IDs currently in library
const calibreIds = new Set(calibreBooks.map(b => b.id));

// After syncing new/updated books...

// Detect removed books - find books whose calibreId is no longer in Calibre
const removedBooks = await Book.find({
  calibreId: { $nin: Array.from(calibreIds) },
  orphaned: { $ne: true },  // Don't re-process already orphaned books
});

for (const book of removedBooks) {
  orphanedBooks.push((book._id as any).toString());
  // Mark as orphaned but don't delete
  await Book.findByIdAndUpdate(book._id, {
    orphaned: true,
    orphanedAt: new Date(),
  });
  removedCount++;
}
```

The `SyncResult` interface now includes removed book tracking:

```typescript
export interface SyncResult {
  success: boolean;
  syncedCount: number;
  updatedCount: number;
  removedCount: number;          // NEW: number of orphaned books
  totalBooks: number;
  orphanedBooks?: string[];      // NEW: IDs of orphaned books
  error?: string;
}
```

---

## Cleanup API Endpoints

All cleanup operations are available at: `POST /api/calibre/cleanup`

### 1. List Orphaned Books

**Request:**
```json
{
  "action": "list"
}
```

**Response:**
```json
{
  "success": true,
  "count": 5,
  "orphanedBooks": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "title": "Book Title",
      "authors": ["Author Name"],
      "calibreId": 42,
      "orphanedAt": "2025-11-17T12:00:00.000Z"
    },
    // ... more books
  ]
}
```

### 2. Permanently Delete Orphaned Books

**Request:**
```json
{
  "action": "permanent-delete"
}
```

**Response:**
```json
{
  "success": true,
  "deletedCount": 5,
  "details": {
    "books": 5,
    "statuses": 5,
    "logs": 23
  },
  "message": "Permanently deleted 5 orphaned books and their records"
}
```

**What gets deleted:**
- Book documents from `Book` collection
- Associated `ReadingSession` records
- Associated `ProgressLog` entries (reading history)

**⚠️ Warning:** This action is permanent and cannot be undone!

### 3. Restore Orphaned Books

**Request:**
```json
{
  "action": "restore"
}
```

**Response:**
```json
{
  "success": true,
  "restoredCount": 5,
  "message": "Restored 5 books"
}
```

**Use case:** If books become un-orphaned (re-added to Calibre), restore them to active status.

---

## Books API Updates

The books endpoint automatically excludes orphaned books by default:

### Normal query (excludes orphaned)
```
GET /api/books?status=to-read&limit=50
```
- Returns only active books with "to-read" status
- Orphaned books are hidden

### View orphaned books only
```
GET /api/books?showOrphaned=true&limit=50
```
- Returns only orphaned books
- Useful for reviewing before deletion

---

## Sync Response Example

After syncing with Calibre, if books are removed:

```json
{
  "success": true,
  "syncedCount": 3,
  "updatedCount": 12,
  "removedCount": 2,
  "totalBooks": 127,
  "orphanedBooks": ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012"]
}
```

---

## Workflow Examples

### Example 1: Review and Delete Orphaned Books

```bash
# 1. Check what's orphaned
curl -X POST http://localhost:3000/api/calibre/cleanup \
  -H "Content-Type: application/json" \
  -d '{"action": "list"}'

# 2. Review the orphaned books in response
# 3. If you want to delete them:
curl -X POST http://localhost:3000/api/calibre/cleanup \
  -H "Content-Type: application/json" \
  -d '{"action": "permanent-delete"}'
```

### Example 2: Accidental Deletion Recovery

If books were accidentally deleted from Calibre but you still want them:

```bash
# 1. Re-add them to Calibre
# 2. Sync (they won't be removed again)
# 3. Restore any previously orphaned books
curl -X POST http://localhost:3000/api/calibre/cleanup \
  -H "Content-Type: application/json" \
  -d '{"action": "restore"}'
```

### Example 3: Batch Cleanup

Before a major library reorganization:

1. Sync your Calibre library
2. Review orphaned books via `action: "list"`
3. Manually evaluate each one
4. Delete with `action: "permanent-delete"` when ready

---

## UI Integration (Future)

Consider adding a settings or admin page with:

```typescript
// Pseudocode for UI components
<OrphanedBooksManager>
  <OrphanedBooksList onRefresh={handleRefresh} />
  <div>
    <button onClick={() => cleanup("list")}>List Orphaned</button>
    <button onClick={() => cleanup("restore")}>Restore All</button>
    <button onClick={() => cleanup("permanent-delete")}>Delete All</button>
  </div>
</OrphanedBooksManager>
```

---

## Data Consistency

The cleanup system maintains referential integrity:

- **Books → ReadingSession**: When a book is deleted, all reading sessions are deleted
- **Books → ProgressLog**: When a book is deleted, all progress entries are deleted
- **Orphaned flag**: Books marked `orphaned: true` don't break any relationships

---

## Monitoring & Alerts

To add operational visibility:

```typescript
// Track orphan accumulation
export async function getOrphanStats() {
  const count = await Book.countDocuments({ orphaned: true });
  const oldest = await Book.findOne({ orphaned: true })
    .sort({ orphanedAt: 1 });
  
  return {
    orphanedCount: count,
    oldestOrphanDate: oldest?.orphanedAt,
  };
}
```

---

## Related Documentation

- **BOOK_TRACKER_ARCHITECTURE.md** - Overall sync mechanism
- **BOOK_TRACKER_QUICK_REFERENCE.md** - Quick API reference
- **lib/sync-service.ts** - Implementation details
- **models/Book.ts** - Schema definition
