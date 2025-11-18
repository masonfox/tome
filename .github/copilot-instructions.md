# GitHub Copilot Instructions for Tome

## 📚 Required Reading

**Before suggesting code, reference these docs:**

1. **[`docs/AI_CODING_PATTERNS.md`](../docs/AI_CODING_PATTERNS.md)** ⭐ **PRIMARY REFERENCE**
   - All code patterns, styles, and guidelines
   - Critical SQLite runtime detection pattern
   - Test patterns, what to do/not do

2. **[`docs/BOOK_TRACKER_ARCHITECTURE.md`](../docs/BOOK_TRACKER_ARCHITECTURE.md)**
   - System architecture, API structure, database models

3. **[`docs/BOOK_TRACKER_QUICK_REFERENCE.md`](../docs/BOOK_TRACKER_QUICK_REFERENCE.md)**
   - Code examples and common patterns

## 💡 Copilot Tips

### For Inline Completions

**When suggesting code in:**
- `lib/db/calibre.ts` → Use runtime detection pattern (see docs/AI_CODING_PATTERNS.md)
- `__tests__/**` → Use mongodb-memory-server, no global mocks
- `app/api/**` → Follow Next.js 14 App Router patterns
- Components → Server Components by default, add `"use client"` only when needed

### Common Completions

```typescript
// Import Calibre functions (ALWAYS use abstraction)
import { getAllBooks, getBookById } from "@/lib/db/calibre";

// MongoDB models
import Book from "@/models/Book";
import ReadingStatus from "@/models/ReadingStatus";

// Next.js API
import { NextRequest, NextResponse } from "next/server";

// Tests
import { test, expect, beforeAll, afterAll } from "bun:test";
```

### Critical Patterns

**SQLite Access:**
- ✅ Use `lib/db/calibre.ts` functions
- ❌ Don't import `bun:sqlite` or `better-sqlite3` directly

**Testing:**
- ✅ Use mongodb-memory-server
- ❌ Don't use global module mocks

**Components:**
- ✅ Server Component (default)
- ✅ Client Component with `"use client"` (when interactive)

## 🚫 What NOT to Suggest

❌ Direct SQLite imports (use `lib/db/calibre.ts` instead)
❌ Global test mocks (causes leakage)
❌ Writing to Calibre database (read-only!)
❌ `any` types (use proper TypeScript types)
❌ New markdown files in `/docs` (unless requested)

## ✅ What TO Suggest

✅ Using runtime detection pattern for SQLite
✅ Proper error handling with try/catch
✅ TypeScript interfaces for data structures
✅ Tailwind CSS classes (not CSS files)
✅ Following established patterns from docs

## 📖 Full Documentation

For complete coding patterns and guidelines:
**See [`docs/AI_CODING_PATTERNS.md`](../docs/AI_CODING_PATTERNS.md)**

For system architecture and design:
**See [`docs/BOOK_TRACKER_ARCHITECTURE.md`](../docs/BOOK_TRACKER_ARCHITECTURE.md)**

---

**When uncertain:** Check `docs/AI_CODING_PATTERNS.md` or `docs/README.md` for guidance
