# AI Assistant Instructions for Tome

**Universal guidance for all AI coding assistants working on the Tome project.**

---

## 📌 QUICK CONTEXT CARD

> **Migration Completed:** MongoDB → SQLite (January 2025)
> **Current Tech Stack:** SQLite + Drizzle ORM + Repository Pattern
> **Tests:** 295/295 passing (100%)
> **Database:** 2 SQLite databases (Tome tracking + Calibre library)
> **Data Access:** Repository Pattern (NEVER import db directly)

**Key Changes:**
- ❌ NO MongoDB/Mongoose (legacy, being removed)
- ✅ YES SQLite + Drizzle + Repositories
- ✅ YES `bookRepository`, `sessionRepository`, etc.
- ✅ YES Test isolation via `setDatabase()` / `resetDatabase()`

**See:** [`docs/SQLITE_MIGRATION_STATUS.md`](./docs/SQLITE_MIGRATION_STATUS.md) for complete migration details

---

## 🎯 Primary Directive

**Consult project documentation before making architectural changes or suggesting code patterns.**

All documentation is centralized in the [`/docs`](./docs) directory for easy maintenance and consistency.

---

## 📚 Essential Documentation (Read in Order)

### 1. **[`docs/AI_CODING_PATTERNS.md`](./docs/AI_CODING_PATTERNS.md)** ⭐ **START HERE**

**Single source of truth for all coding patterns.**

Contains:
- Repository Pattern (PRIMARY data access pattern)
- Critical SQLite runtime detection pattern
- Test database isolation patterns (`setDatabase`, `resetDatabase`)
- Calibre write operations (ratings only)
- Code style guidelines (TypeScript, React, naming)
- Common AI mistakes to avoid
- What to DO and what NOT to do

**Read this before writing any code.**

### 2. **[`docs/REPOSITORY_PATTERN_GUIDE.md`](./docs/REPOSITORY_PATTERN_GUIDE.md)** 🔑 **CRITICAL**

**Complete guide to the Repository Pattern.**

Contains:
- BaseRepository API reference (all CRUD methods)
- Specialized repositories (Book, Session, Progress, Streak)
- How to create custom repositories
- Testing with repositories
- Best practices and common patterns

**Read this before accessing the database.**

### 3. **[`docs/SQLITE_MIGRATION_STATUS.md`](./docs/SQLITE_MIGRATION_STATUS.md)**

**Migration status and quick reference.**

Contains:
- Current tech stack (SQLite + Drizzle + Repositories)
- Quick decision tree (what to use when)
- Migration timeline and status
- Before/after code examples

**Read this to understand the current state.**

### 4. **[`docs/BOOK_TRACKER_ARCHITECTURE.md`](./docs/BOOK_TRACKER_ARCHITECTURE.md)**

**Complete system architecture and technical design.**

Contains:
- Directory structure and overall architecture
- Database schemas (SQLite + Drizzle)
- Calibre integration and sync mechanism
- API routes structure
- Frontend architecture (Next.js 14)
- Deployment with Docker

**Read this to understand how everything fits together.**

### 5. **[`docs/BOOK_TRACKER_QUICK_REFERENCE.md`](./docs/BOOK_TRACKER_QUICK_REFERENCE.md)**

**Code snippets and common patterns.**

Contains:
- Repository-based query examples
- API route examples
- Sync flow patterns
- Component patterns

**Read this for quick code examples.**

### 6. **[`__tests__/README.md`](./__tests__/README.md)**

**Testing patterns and guidelines (295 tests).**

Contains:
- Test structure and best practices
- Test database isolation (SQLite)
- Common pitfalls and solutions

**Read this before writing tests.**

### 7. **[`docs/README.md`](./docs/README.md)**

**Complete documentation index.**

Contains:
- Documentation overview
- AI assistant guidance
- Documentation reading order

**Use this to navigate all documentation.**

---

## 🔑 Most Critical Pattern

**SQLite Runtime Detection** (lib/db/calibre.ts:23-34)

This pattern enables automatic Calibre sync in both dev (Node.js) and production (Bun).

**See [`docs/AI_CODING_PATTERNS.md`](./docs/AI_CODING_PATTERNS.md) for the complete pattern and explanation.**

Never deviate from this pattern when accessing SQLite.

---

## 🧭 Quick Navigation by Task

| Task | Primary Documentation |
|------|----------------------|
| **Writing code** | [`docs/AI_CODING_PATTERNS.md`](./docs/AI_CODING_PATTERNS.md) |
| **Understanding architecture** | [`docs/BOOK_TRACKER_ARCHITECTURE.md`](./docs/BOOK_TRACKER_ARCHITECTURE.md) |
| **Finding code examples** | [`docs/BOOK_TRACKER_QUICK_REFERENCE.md`](./docs/BOOK_TRACKER_QUICK_REFERENCE.md) |
| **Writing tests** | [`__tests__/README.md`](./__tests__/README.md) |
| **Navigating all docs** | [`docs/README.md`](./docs/README.md) |

---

## 🎨 Tool-Specific Instructions

### Claude Code
See [`.claude/instructions.md`](./.claude/instructions.md) for Claude Code-specific workflow

### GitHub Copilot
See [`.github/copilot-instructions.md`](./.github/copilot-instructions.md) for Copilot-specific inline completion tips

### Other AI Tools
Follow this document + [`docs/README.md`](./docs/README.md) for comprehensive guidance

---

## 📋 Essential Rules

### ✅ DO

1. **Read [`docs/AI_CODING_PATTERNS.md`](./docs/AI_CODING_PATTERNS.md) before writing code**
2. **Use repositories** for all Tome database access (`bookRepository`, etc.)
3. **Use `setDatabase()` and `resetDatabase()`** in tests for isolation
4. **Run `bun test`** before completing tasks (all 295 tests must pass)
5. **Follow the SQLite runtime detection pattern** (from lib/db/calibre.ts)
6. **Update docs** when making architectural or pattern changes
7. **Ask for clarification** when documentation is unclear

### ❌ DON'T

1. **Import `db` directly** (use repositories instead)
2. **Use Mongoose models** (legacy - use repositories)
3. **Write to Calibre database** (except ratings via `updateCalibreRating()`)
4. **Use global mocks in tests** (causes test isolation issues)
5. **Import SQLite directly** (always use `lib/db/calibre.ts` or repositories)
6. **Create new markdown files** without explicit user request
7. **Skip documentation** before making architectural changes

---

## 🔄 Decision Framework

When making a decision:

```
Need to access Tome database?
├─ YES → Use repositories (lib/repositories/)
│        ├─ bookRepository, sessionRepository, etc.
│        └─ NEVER import db directly!
└─ NO  → Continue

Need to access Calibre database?
├─ Read-only → Use lib/db/calibre.ts
└─ Write (ratings only) → Use lib/db/calibre-write.ts

Is it documented?
├─ YES → Follow the documentation
└─ NO  → Check if similar pattern exists
         ├─ YES → Follow similar pattern
         └─ NO  → Ask user for guidance

Does it affect architecture?
├─ YES → Read docs/BOOK_TRACKER_ARCHITECTURE.md first
└─ NO  → Proceed with established patterns

Writing tests?
├─ YES → Use setDatabase(testDb) and resetDatabase()
│        └─ See docs/AI_CODING_PATTERNS.md
└─ NO  → Continue

Is it a new feature?
├─ YES → Read docs, implement with repositories, test, update docs
└─ NO  → Proceed following patterns
```

---

## ⚡ Quick Commands

```bash
# Development
bun install                    # Install dependencies
bun run dev                    # Start dev server (auto-sync enabled)
bun test                       # Run all 295 tests (must pass - 100%)
bun run build                  # Build for production

# Database
bunx drizzle-kit generate      # Generate migration from schema changes
bunx drizzle-kit push          # Apply migrations to database

# View documentation
cat docs/AI_CODING_PATTERNS.md            # Coding patterns (START HERE)
cat docs/REPOSITORY_PATTERN_GUIDE.md      # Repository pattern guide
cat docs/SQLITE_MIGRATION_STATUS.md       # Migration status
cat docs/BOOK_TRACKER_ARCHITECTURE.md     # Architecture
cat docs/README.md                        # Documentation index
cat __tests__/README.md                   # Testing guide
```

---

## 📖 Learning Path

**For new AI assistants to this project:**

1. Read [`AI_INSTRUCTIONS.md`](./AI_INSTRUCTIONS.md) (this file)
2. Read [`docs/AI_CODING_PATTERNS.md`](./docs/AI_CODING_PATTERNS.md) - All coding patterns
3. Skim [`docs/BOOK_TRACKER_ARCHITECTURE.md`](./docs/BOOK_TRACKER_ARCHITECTURE.md) - Sections 1-4
4. Skim [`docs/BOOK_TRACKER_QUICK_REFERENCE.md`](./docs/BOOK_TRACKER_QUICK_REFERENCE.md)
5. Review [`__tests__/README.md`](./__tests__/README.md)
6. You're ready!

---

## 🆘 When Uncertain

If unsure about:
- **Code patterns** → [`docs/AI_CODING_PATTERNS.md`](./docs/AI_CODING_PATTERNS.md)
- **Architecture** → [`docs/BOOK_TRACKER_ARCHITECTURE.md`](./docs/BOOK_TRACKER_ARCHITECTURE.md)
- **Code examples** → [`docs/BOOK_TRACKER_QUICK_REFERENCE.md`](./docs/BOOK_TRACKER_QUICK_REFERENCE.md)
- **Testing** → [`__tests__/README.md`](./__tests__/README.md)
- **Navigation** → [`docs/README.md`](./docs/README.md)
- **Anything else** → Ask the user

**Better to ask than to guess and deviate from established patterns.**

---

## 🏗️ Tech Stack Summary

- **Framework:** Next.js 14 (App Router)
- **Runtime:** Node.js (dev) / Bun (production)
- **Package Manager:** Bun
- **Databases:**
  - **Tome DB:** SQLite + Drizzle ORM (tracking data: books, sessions, progress, streaks)
  - **Calibre DB:** SQLite (read-only metadata.db from Calibre library)
- **Data Access:** Repository Pattern (lib/repositories/)
- **SQLite Libraries:** better-sqlite3 (Node.js) / bun:sqlite (Bun)
- **Testing:** Bun test runner (295 tests, 100% passing)
- **Test Isolation:** setDatabase() / resetDatabase() pattern

**See [`docs/BOOK_TRACKER_ARCHITECTURE.md`](./docs/BOOK_TRACKER_ARCHITECTURE.md) for complete details.**
**See [`docs/SQLITE_MIGRATION_STATUS.md`](./docs/SQLITE_MIGRATION_STATUS.md) for migration info.**

---

## 📌 Remember

- **Documentation is the source of truth** - Follow it unless explicitly asked to change
- **Patterns exist for a reason** - Don't reinvent unless there's a clear problem
- **Tests must pass** - No exceptions (run `bun test`)
- **Ask when uncertain** - Better to clarify than to guess

---

**For complete coding patterns:** See [`docs/AI_CODING_PATTERNS.md`](./docs/AI_CODING_PATTERNS.md)

**For repository pattern details:** See [`docs/REPOSITORY_PATTERN_GUIDE.md`](./docs/REPOSITORY_PATTERN_GUIDE.md)

**For comprehensive documentation:** Start at [`docs/README.md`](./docs/README.md)

**Last Updated:** 2025-11-20
**Project:** Tome (Book Tracker with Calibre Integration)
**Tech Stack:** SQLite + Drizzle ORM + Repository Pattern
