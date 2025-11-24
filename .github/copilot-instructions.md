# GitHub Copilot Instructions for Tome

**Read the universal AI instructions first:** [`AI_INSTRUCTIONS.md`](../AI_INSTRUCTIONS.md)

---

## 📚 Quick Start

All documentation is in `AI_INSTRUCTIONS.md`. This file contains only Copilot-specific inline completion hints.

**Essential reading order:**
1. `.specify/memory/constitution.md` - Project principles
2. `.specify/memory/patterns.md` - Code patterns with examples
3. `docs/ARCHITECTURE.md` - System design
4. `docs/AI_CODING_PATTERNS.md` - Coding standards

---

## 💡 Copilot-Specific Inline Completion Hints

### Context-Aware Suggestions

**When suggesting code in:**
- `lib/db/factory.ts` → Use Database Factory Pattern (see `.specify/memory/patterns.md` Pattern 1)
- `lib/repositories/**` → Follow Repository Pattern (Pattern 3)
- `lib/services/**` → Follow Service Layer Pattern (thin routes, fat services)
- `__tests__/**` → Use `setDatabase(testDb)` and `resetDatabase()` (Pattern 2)
- `app/api/**` → Follow Next.js 14 App Router patterns, use repositories
- Components → Server Components by default, add `"use client"` only when needed
- `hooks/**` → Custom hooks for complex state management

### Common Import Completions

```typescript
// Database access - ALWAYS use repositories
import { bookRepository } from "@/lib/repositories/book.repository";
import { sessionRepository } from "@/lib/repositories/session.repository";
import { progressRepository } from "@/lib/repositories/progress.repository";

// Calibre access (read-only)
import { getAllBooks, getBookById } from "@/lib/db/calibre";

// Calibre write (ratings only!)
import { updateCalibreRating } from "@/lib/db/calibre-write";

// Service layer
import { bookService } from "@/lib/services/book.service";
import { sessionService } from "@/lib/services/session.service";

// Next.js API
import { NextRequest, NextResponse } from "next/server";

// Tests
import { test, expect, beforeEach } from "bun:test";
import { setDatabase, resetDatabase } from "@/lib/db/context";
import { db as testDb } from "@/lib/db/sqlite";
```

### Critical Patterns to Suggest

**Repository Pattern (PRIMARY):**
```typescript
// ✅ Correct - Use repository
const books = await bookRepository.findWithFilters({ status: "reading" }, 50, 0);

// ❌ Wrong - Direct db access
import { db } from "@/lib/db/sqlite";
const books = db.select().from(books).all();
```

**Test Isolation:**
```typescript
// ✅ Correct - Test isolation
beforeEach(async () => {
  setDatabase(testDb);
  resetDatabase();
});

// ❌ Wrong - No isolation
test("should create book", async () => {
  // Previous test data still here!
});
```

**Database Factory:**
```typescript
// ✅ Correct - Use factory
import { createDatabase } from "@/lib/db/factory";
const { db, sqlite, runtime } = createDatabase({ path, schema, wal: true });

// ❌ Wrong - Direct import
import { Database } from "bun:sqlite";
```

---

## 🚫 What NOT to Suggest

❌ Direct `db` imports (violates Repository Pattern - see constitution)
❌ Direct SQLite driver imports (violates Database Factory Pattern)
❌ Writing to Calibre except via `updateCalibreRating()`
❌ Global test mocks (causes test leakage)
❌ `any` types (use proper TypeScript)
❌ Bypassing repositories (violates architecture)

---

## ✅ What TO Suggest

✅ Repository methods (`bookRepository.findById()`, etc.)
✅ Database Factory Pattern for connections
✅ Test isolation with `setDatabase()`/`resetDatabase()`
✅ Proper error handling with try/catch
✅ TypeScript interfaces for data structures
✅ Tailwind CSS classes (not CSS files)
✅ Server Components by default
✅ Following patterns from `.specify/memory/patterns.md`

---

## 📖 Full Documentation

**Constitution & Principles:** `.specify/memory/constitution.md`
**Code Patterns:** `.specify/memory/patterns.md` (10 patterns with working code)
**Architecture:** `docs/ARCHITECTURE.md`
**Coding Standards:** `docs/AI_CODING_PATTERNS.md`
**Universal Guide:** `AI_INSTRUCTIONS.md`

---

**When uncertain:** Check `.specify/memory/patterns.md` for code examples or `AI_INSTRUCTIONS.md` for guidance

**Last Updated:** 2025-11-24
