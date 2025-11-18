# AI Assistant Instructions for Tome

**Universal guidance for all AI coding assistants working on the Tome project.**

## 🎯 Primary Directive

**Consult project documentation before making architectural changes or suggesting code patterns.**

All documentation is centralized in the [`/docs`](./docs) directory for easy maintenance and consistency.

---

## 📚 Essential Documentation (Read in Order)

### 1. **[`docs/AI_CODING_PATTERNS.md`](./docs/AI_CODING_PATTERNS.md)** ⭐ **START HERE**

**Single source of truth for all coding patterns.**

Contains:
- Critical SQLite runtime detection pattern (THE most important pattern)
- Test isolation patterns
- Code style guidelines (TypeScript, React, naming)
- Common imports and database patterns
- What to DO and what NOT to do
- API route patterns and workflows

**Read this before writing any code.**

### 2. **[`docs/BOOK_TRACKER_ARCHITECTURE.md`](./docs/BOOK_TRACKER_ARCHITECTURE.md)**

Complete system architecture and technical design.

Contains:
- Directory structure and overall architecture
- Database models (MongoDB + SQLite)
- Calibre integration and sync mechanism
- API routes structure
- Frontend architecture (Next.js 14)
- Deployment with Docker

**Read this to understand how everything fits together.**

### 3. **[`docs/BOOK_TRACKER_QUICK_REFERENCE.md`](./docs/BOOK_TRACKER_QUICK_REFERENCE.md)**

Code snippets and common patterns.

Contains:
- Database query examples
- API route examples
- Component patterns
- Common operations

**Read this for quick code examples.**

### 4. **[`__tests__/README.md`](./__tests__/README.md)**

Testing patterns and guidelines (99 tests).

Contains:
- Test structure and best practices
- Test isolation patterns
- mongodb-memory-server usage
- Common pitfalls and solutions

**Read this before writing tests.**

### 5. **[`docs/README.md`](./docs/README.md)**

Complete documentation index.

Contains:
- Documentation overview
- AI assistant guidance
- Documentation reading order
- Search tips

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
2. **Follow the SQLite runtime detection pattern** (from lib/db/calibre.ts)
3. **Run `bun test`** before completing tasks (all 99 tests must pass)
4. **Update docs** when making architectural or pattern changes
5. **Ask for clarification** when documentation is unclear

### ❌ DON'T

1. **Create new markdown files** without explicit user request
2. **Use global mocks in tests** (causes test isolation issues)
3. **Write to Calibre database** (it's read-only)
4. **Import SQLite directly** (always use `lib/db/calibre.ts`)
5. **Skip documentation** before making architectural changes

---

## 🔄 Decision Framework

When making a decision:

```
Is it documented?
├─ YES → Follow the documentation
└─ NO  → Check if similar pattern exists
         ├─ YES → Follow similar pattern
         └─ NO  → Ask user for guidance

Does it affect architecture?
├─ YES → Read docs/BOOK_TRACKER_ARCHITECTURE.md first
└─ NO  → Proceed with established patterns

Does it involve SQLite?
├─ YES → Use pattern from lib/db/calibre.ts
└─ NO  → Follow docs/AI_CODING_PATTERNS.md

Is it a new feature?
├─ YES → Read docs, implement, test, update docs
└─ NO  → Proceed following patterns
```

---

## ⚡ Quick Commands

```bash
# Development
bun install                    # Install dependencies
bun run dev                    # Start dev server (auto-sync enabled)
bun test                       # Run all 99 tests (must pass)
bun run build                  # Build for production

# View documentation
cat docs/AI_CODING_PATTERNS.md           # Coding patterns (START HERE)
cat docs/BOOK_TRACKER_ARCHITECTURE.md    # Architecture
cat docs/README.md                       # Documentation index
cat __tests__/README.md                  # Testing guide
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
- **Runtime:** Node.js (dev) / Bun (production, optional)
- **Package Manager:** Bun
- **Databases:** MongoDB (user data) + SQLite (Calibre, read-only)
- **SQLite Libraries:** better-sqlite3 (Node.js) / bun:sqlite (Bun)
- **Testing:** Bun test runner + mongodb-memory-server

**See [`docs/BOOK_TRACKER_ARCHITECTURE.md`](./docs/BOOK_TRACKER_ARCHITECTURE.md) for complete details.**

---

## 📌 Remember

- **Documentation is the source of truth** - Follow it unless explicitly asked to change
- **Patterns exist for a reason** - Don't reinvent unless there's a clear problem
- **Tests must pass** - No exceptions (run `bun test`)
- **Ask when uncertain** - Better to clarify than to guess

---

**For complete coding patterns:** See [`docs/AI_CODING_PATTERNS.md`](./docs/AI_CODING_PATTERNS.md)

**For comprehensive documentation:** Start at [`docs/README.md`](./docs/README.md)

**Last Updated:** 2025-11-18
**Project:** Tome (Book Tracker with Calibre Integration)
