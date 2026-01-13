# Calibre Database Safety Guide

**Understanding how Tome safely writes to the Calibre database**

---

## Table of Contents

1. [Overview](#overview)
2. [Why Tome Writes to Calibre](#why-tome-writes-to-calibre)
3. [When to Close Calibre](#when-to-close-calibre)
4. [How Tome Protects Your Data](#how-tome-protects-your-data)
5. [Troubleshooting Lock Errors](#troubleshooting-lock-errors)
6. [Developer Notes](#developer-notes)
7. [References](#references)

---

## Overview

Tome integrates deeply with Calibre's database to provide a seamless reading tracking experience. While Tome primarily **reads** from the Calibre database, it **writes** to it in two specific scenarios:

1. **Book Ratings** - Syncing your ratings back to Calibre
2. **Book Tags** - Managing tags for shelving and organization

This document explains how Tome ensures these write operations are safe and how to handle potential database lock situations.

---

## Why Tome Writes to Calibre

### Approved Write Operations

Tome writes to the Calibre database for these reasons:

#### 1. **Book Ratings** (`updateCalibreRating`)
- **What:** Updates the `ratings` table and `books_ratings_link` junction table
- **When:** When you rate a book in Tome (1-5 stars)
- **Why:** Keeps your ratings in sync with Calibre so they're reflected in the Calibre GUI
- **Files:** `lib/db/calibre-write.ts:updateCalibreRating()`

#### 2. **Book Tags** (`updateCalibreTags`, `batchUpdateCalibreTags`)
- **What:** Updates the `tags` table and `books_tags_link` junction table
- **When:** When you add/remove books from shelves or apply tags in Tome
- **Why:** Tome uses Calibre tags for shelving, making shelves visible in Calibre
- **Files:** `lib/db/calibre-write.ts:updateCalibreTags()`, `lib/db/calibre-write.ts:batchUpdateCalibreTags()`

### Read-Only Operations

Everything else is **read-only**:
- Book metadata (title, author, series, etc.)
- Book files and formats
- Custom columns
- All other Calibre data

**Tome treats Calibre as the source of truth** for book metadata and never modifies it.

---

## When to Close Calibre

### ⚠️ Required: Close Calibre for Tag Operations

**YOU MUST CLOSE CALIBRE** before performing these operations in Tome:
- Adding books to a shelf
- Removing books from a shelf
- Creating a new shelf
- Deleting a shelf
- Bulk tag operations

**Why?** SQLite databases only allow **one writer at a time**. If Calibre is open, it holds a write lock on the database, and Tome's tag operations will fail with a "database is locked" error.

### ✅ Optional: Calibre Can Stay Open

These operations are **safe with Calibre open**:
- **Rating a book** - Tome's watcher has retry logic (see below)
- **Auto-sync** - Tome watches for Calibre changes and syncs automatically with retry
- **Browsing books** - All read operations work fine

### How It Works: Watcher Suspension

When Tome writes tags, it automatically **suspends the file watcher** to prevent re-syncing its own changes:

```typescript
// lib/services/tag.service.ts
calibreWatcher.suspend();           // Stop watching
await updateCalibreTags(calibreId, tags);  // Write tags
calibreWatcher.resumeWithIgnorePeriod(5000);  // Resume after 5s
```

This prevents a "write → detect change → re-sync → write" loop.

---

## How Tome Protects Your Data

Tome implements multiple layers of safety to prevent data corruption and race conditions:

### 1. **Watcher Retry Logic** 🔄

The Calibre file watcher has built-in retry logic for transient database locks:

- **Detects lock errors:** Catches `SQLITE_BUSY` and `SQLITE_LOCKED` errors
- **Retries 3 times:** Exponential backoff: 1s, 2s, 3s between attempts
- **Gives up gracefully:** After 3 attempts, logs error and stops (no data corruption)
- **Non-lock errors fail immediately:** Only retries on lock errors

**File:** `lib/calibre-watcher.ts:triggerSync()`

```typescript
const MAX_RETRIES = 3;
let attempt = 0;

while (attempt < MAX_RETRIES) {
  try {
    await syncCallback();
    return; // Success!
  } catch (error) {
    const isLockError = error.message.toLowerCase().includes('locked') 
                     || error.message.toLowerCase().includes('busy');
    
    if (isLockError && attempt < MAX_RETRIES) {
      await delay(1000 * attempt); // 1s, 2s, 3s backoff
      attempt++;
      continue;
    } else {
      throw error; // Non-lock error or max retries reached
    }
  }
}
```

### 2. **Watcher Suspension** ⏸️

During write operations, the watcher can be suspended to prevent re-syncing self-inflicted changes:

- **`calibreWatcher.suspend()`** - Stops watching for file changes
- **`calibreWatcher.resume()`** - Resumes watching immediately
- **`calibreWatcher.resumeWithIgnorePeriod(ms)`** - Resumes but ignores changes for N milliseconds

**Usage in tag operations:**
```typescript
// lib/services/tag.service.ts
calibreWatcher.suspend();           // Pause watcher
await batchUpdateCalibreTags(operations);  // Write tags
calibreWatcher.resumeWithIgnorePeriod(5000);  // Resume after 5s
```

**File:** `lib/calibre-watcher.ts`

### 3. **Debouncing** ⏱️

File change events are debounced by **2 seconds** to prevent sync storms from rapid file changes:

- Detects file change → waits 2 seconds
- If another change detected → resets timer
- Only syncs after 2 seconds of quiet time

**File:** `lib/calibre-watcher.ts:start()` (line 50)

### 4. **Single-Instance Guard** 🔒

The `isSyncing` flag prevents concurrent sync operations:

```typescript
if (this.syncing) {
  logger.info("[WATCHER] Sync already in progress, skipping");
  return;
}
this.syncing = true;
// ... perform sync ...
this.syncing = false;
```

**File:** `lib/calibre-watcher.ts:triggerSync()`

### 5. **Enhanced Error Messages** 💬

Lock errors provide clear, actionable guidance:

```
Calibre database is locked. Please close Calibre and try again. 
If Calibre is already closed, wait a few seconds and retry. 
(Book ID: 123)
```

**Files:** 
- `lib/db/calibre-write.ts:updateCalibreRating()` (line ~163)
- `lib/db/calibre-write.ts:updateCalibreTags()` (line ~312)
- `lib/db/calibre-write.ts:batchUpdateCalibreTags()` (line ~408)

---

## Troubleshooting Lock Errors

### Error: "Calibre database is locked"

**Symptom:** You see this error when trying to add books to a shelf or perform tag operations.

**Cause:** Calibre is currently open and holding a write lock on the database.

**Solution:**
1. **Close Calibre** completely (not just minimized)
2. **Wait 2-3 seconds** for Calibre to release the lock
3. **Retry the operation** in Tome

### Error: "SQLITE_BUSY: database is busy"

**Symptom:** Intermittent errors during auto-sync or rating updates.

**Cause:** Calibre is actively writing to the database when Tome tries to sync.

**Solution:**
- **For auto-sync:** Tome will automatically retry (3 attempts with backoff)
- **For manual operations:** Wait a few seconds and retry
- **If persistent:** Close Calibre and retry

### Error: Lock persists after closing Calibre

**Symptom:** "Database is locked" error even after closing Calibre.

**Possible causes:**
1. **Calibre not fully closed** - Check Task Manager/Activity Monitor
2. **Stale lock file** - Calibre's `-wal` or `-shm` files may be orphaned
3. **Another process** - Another SQLite connection may be holding the lock

**Solution:**
1. Verify Calibre is fully closed (check process list)
2. Wait 5-10 seconds for locks to clear
3. If needed, delete `-wal` and `-shm` files next to `metadata.db` (only when Calibre is closed!)
4. Restart Tome

### Performance: Slow tag operations

**Symptom:** Tag operations take longer than expected.

**Cause:** Large tag batches or slow disk I/O.

**Not a bug:** Tag operations suspend the watcher and must complete before resuming. This is intentional to prevent race conditions.

**Tips:**
- Close Calibre before large batch operations
- Perform bulk tag operations during off-peak times
- Consider breaking very large operations (1000+ books) into smaller batches

---

## Developer Notes

### Safe Write Operation Checklist

When adding new write operations to Calibre DB, follow this checklist:

- [ ] **Verify necessity** - Can this be read-only? Should it be stored in Tome DB instead?
- [ ] **Use calibre-write.ts** - All write operations go through `lib/db/calibre-write.ts`
- [ ] **Implement retry logic** - Detect lock errors and retry with backoff (if appropriate)
- [ ] **Add clear error messages** - Include operation context, book ID, and actionable guidance
- [ ] **Suspend watcher if needed** - Use `calibreWatcher.suspend()` / `resumeWithIgnorePeriod()`
- [ ] **Add structured logging** - Include operation type, calibreId, tags, etc.
- [ ] **Test with Calibre open** - Verify lock error handling works correctly
- [ ] **Test concurrent operations** - Verify no race conditions or data corruption
- [ ] **Document in this file** - Update [Approved Write Operations](#approved-write-operations)

### Code Locations

**Write Operations:**
- `lib/db/calibre-write.ts` - All Calibre write functions
  - `updateCalibreRating(calibreId, stars)` - Update book rating
  - `updateCalibreTags(calibreId, tags)` - Update tags for one book
  - `batchUpdateCalibreTags(operations)` - Update tags for multiple books
  - `readCalibreRating(calibreId)` - Read rating (for verification)
  - `readCalibreTags(calibreId)` - Read tags (for verification)

**Watcher:**
- `lib/calibre-watcher.ts` - File watcher with retry logic
  - `start(calibreDbPath, onSync)` - Start watching
  - `triggerSync()` - Sync with retry logic (private)
  - `suspend()` - Pause watcher
  - `resume()` - Resume watcher
  - `resumeWithIgnorePeriod(ms)` - Resume after ignore period

**Services:**
- `lib/services/calibre.service.ts` - Service layer (testable wrapper)
- `lib/services/tag.service.ts` - Tag operations (uses watcher suspension)

**Tests:**
- `__tests__/lib/calibre-write.test.ts` - 65 tests for write operations
- `__tests__/lib/calibre-watcher.test.ts` - 11 tests for retry logic
- `__tests__/lib/calibre.test.ts` - 46 tests for read operations

### Design Decisions

**Why not use Calibre's API?**
- Calibre's `calibredb` CLI is slow (spawns Python process each time)
- Direct SQLite access is faster and more reliable
- We only write to well-understood, stable tables (ratings, tags)

**Why allow concurrent Calibre + Tome?**
- SQLite allows multiple readers or one writer
- Read operations (vast majority) work fine with Calibre open
- Retry logic handles transient locks for rating updates
- Only tag operations require Calibre to be closed

**Why not use a lock file?**
- SQLite's built-in locking is sufficient
- Additional lock files add complexity and failure modes
- Clear error messages + retry logic is simpler and more robust

---

## References

### Internal Documentation
- [Architecture](./ARCHITECTURE.md) - System design and data flow
- [Constitution](../.specify/memory/constitution.md) - Principle I: Protect User Data
- [Patterns](../.specify/memory/patterns.md) - Pattern 7 (Sync Service), Pattern 8 (File Watcher)
- [Repository Pattern Guide](./REPOSITORY_PATTERN_GUIDE.md) - Data access patterns

### External Resources
- [Reddit Discussion: Calibre Sync Risks](https://www.reddit.com/r/Calibre/comments/1q95ddo/comment/nytv1ol/) - Community discussion on database safety
- [SQLite Locking](https://www.sqlite.org/lockingv3.html) - Official SQLite locking documentation
- [Calibre Database Schema](https://manual.calibre-ebook.com/db_api.html) - Official Calibre database documentation

### Related Issues
- [#252 - Calibre Sync Improvements](https://github.com/masonfox/tome/issues/252) - This implementation

---

## Summary

**Tome is safe to use alongside Calibre** with these guidelines:

✅ **Safe with Calibre open:**
- Browsing books
- Reading metadata
- Rating books
- Auto-sync

⚠️ **Close Calibre before:**
- Adding books to shelves
- Removing books from shelves
- Creating/deleting shelves
- Bulk tag operations

🛡️ **Built-in safety mechanisms:**
- Retry logic for transient locks
- Watcher suspension during writes
- Debouncing to prevent sync storms
- Single-instance guard for concurrent syncs
- Clear, actionable error messages

**When in doubt:** Close Calibre and retry. Tome will never corrupt your Calibre database.
