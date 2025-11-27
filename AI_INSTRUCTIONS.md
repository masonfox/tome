# AI Assistant Instructions for Tome

**Universal guidance for all AI coding assistants working on the Tome project.**

---

## 📌 QUICK START

**Read these documents in order before writing any code:**

1. **Constitution** (`.specify/memory/constitution.md`) - Project principles and governance
2. **Patterns** (`.specify/memory/patterns.md`) - Reusable implementation patterns with code examples
3. **Architecture** (`docs/ARCHITECTURE.md`) - System design and tech stack
4. **Coding Standards** (`docs/AI_CODING_PATTERNS.md`) - Critical patterns and common mistakes

---

## 🎯 Primary Directive

**Consult project documentation before making architectural changes or suggesting code patterns.**

Documentation hierarchy:
1. **SpecKit** (`.specify/memory/`) - Constitution and patterns (single source of truth for principles)
2. **Universal Docs** (`docs/`) - Architecture, guides, and ADRs (accessible to all agents)
3. **Agent Pointers** (`.claude/`, `.github/`) - Thin references (not documentation)

---

## 📚 Essential Documentation (Read in Order)

### 1. **Constitution** ⭐ `.specify/memory/constitution.md`

**Project principles and governance.**

Contains:
- Data Integrity First (Calibre read-only with ratings exception)
- Layered Architecture Pattern (Routes → Services → Repositories)
- Self-Contained Deployment (SQLite only, zero external deps)
- User Experience Standards (smart defaults, temporal validation)
- Observability & Testing (Pino logging, real database tests)

**Read this first to understand the rules.**

### 2. **Patterns** 🔑 `.specify/memory/patterns.md`

**Reusable implementation patterns with working code examples.**

Contains:
- Database Factory Pattern (critical for runtime detection)
- Test Isolation Pattern (setDatabase/resetDatabase)
- Repository Pattern (primary data access)
- Client Service Layer (LibraryService with caching)
- Progress Tracking (auto-calculations)
- Streak Calculation (date normalization)
- Sync Service (Calibre integration)
- File Watcher (debouncing)
- Status State Machine (auto-dates)
- Standard CRUD Routes

**All patterns extracted from production code. Read this before implementing features.**

### 3. **Architecture** 📐 `docs/ARCHITECTURE.md`

**System design and technical architecture.**

Contains:
- System overview (Tome + Calibre integration)
- Technology stack (Next.js 14, SQLite, Drizzle, Bun)
- Data architecture (Tome + Calibre databases)
- Application layers (Routes → Services → Repositories)
- Key features (sessions, progress, streaks, ratings, auto-sync)
- Development patterns (references patterns.md)
- File organization and quick decision guide

**Read this to understand how everything fits together.**

### 4. **Coding Standards** ⚠️ `docs/AI_CODING_PATTERNS.md`

**Critical patterns and common AI mistakes.**

Contains:
- Repository Pattern enforcement (NEVER import db directly)
- Test isolation patterns (setDatabase, resetDatabase)
- Calibre write operations (ratings only via updateCalibreRating)
- Code style guidelines (TypeScript, React, naming)
- Common AI mistakes to avoid
- What to DO and what NOT to do

**Read this before writing any code.**

### 5. **Repository Guide** 📖 `docs/REPOSITORY_PATTERN_GUIDE.md`

**Complete guide to the Repository Pattern.**

Contains:
- BaseRepository API reference (all CRUD methods)
- Specialized repositories (Book, Session, Progress, Streak)
- How to create custom repositories
- Testing with repositories
- Best practices and common patterns

**Read this before accessing the database.**

### 6. **Testing Guide** 🧪 `__tests__/README.md`

**Testing patterns and guidelines (99+ tests).**

Contains:
- Test structure and best practices
- Test database isolation (SQLite)
- Common pitfalls and solutions

**Read this before writing tests.**

### 7. **ADRs** 📋 `docs/ADRs/`

**Architecture Decision Records (why we made key decisions).**

Contains:
- ADR-001: MongoDB → SQLite migration
- ADR-002: Rating architecture (book-level vs session-level)
- ADR-003: Book detail frontend architecture
- ADR-004: Backend service layer architecture

**Read relevant ADRs when working on related features.**

---

## 🔄 SpecKit Workflow (For New Features)

Use SpecKit slash commands for structured feature development:

1. `/speckit.specify` - Create feature specification
2. `/speckit.plan` - Generate implementation plan (includes constitution checks)
3. `/speckit.tasks` - Break down into actionable tasks
4. `/speckit.implement` - Execute implementation

**See `docs/SPECKIT_WORKFLOW.md` for detailed workflow guide.**

---

## 🧭 Quick Navigation by Task

| Task | Primary Documentation |
|------|----------------------|
| **Understanding principles** | `.specify/memory/constitution.md` |
| **Finding code patterns** | `.specify/memory/patterns.md` |
| **Understanding architecture** | `docs/ARCHITECTURE.md` |
| **Writing code** | `docs/AI_CODING_PATTERNS.md` |
| **Using repositories** | `docs/REPOSITORY_PATTERN_GUIDE.md` |
| **Writing tests** | `__tests__/README.md` |
| **Understanding decisions** | `docs/ADRs/` |

---

## 🎨 Tool-Specific Instructions

### Claude Code
See `.claude/instructions.md` for Claude Code-specific workflow (SpecKit commands)

### GitHub Copilot
See `.github/copilot-instructions.md` for Copilot-specific inline completion tips

### Other AI Tools
Follow this document + docs listed above for comprehensive guidance

---

## 🔄 Git Workflow

### Branching Policy

**NEVER commit directly to main.** Always work on feature branches:

1. **Starting Work:**
   - Create a new branch from main: `git checkout -b feature/descriptive-name`
   - Branch naming conventions: `feature/`, `fix/`, `docs/`, `refactor/`
   - Always branch off main, never off other feature branches

2. **During Development:**
   - Commit regularly as you complete phases of work
   - Each commit should represent a logical unit of work
   - Write meaningful commit messages following repository style (check `git log`)
   - Commits should explain WHY, not just WHAT

3. **Completing Work:**
   - Push branch to remote: `git push -u origin branch-name`
   - Create pull request to merge into main (use `gh pr create`)
   - Never merge directly to main without PR

### Commit Guidelines

- **Commit early and often** during development phases
- Each commit should compile and ideally pass tests
- Follow existing commit message style and conventions
- Include co-authorship footer when working with AI assistants
- Stage only relevant files (avoid `git add .` without review)

---

## 📋 Essential Rules

### ✅ DO

1. **Read `.specify/memory/constitution.md`** to understand project principles
2. **Use `.specify/memory/patterns.md`** for implementation patterns
3. **Use repositories** for all Tome database access (`bookRepository`, etc.)
4. **Use `setDatabase()` and `resetDatabase()`** in tests for isolation
5. **Run `bun test`** before completing tasks (all 99+ tests must pass)
6. **Follow the Database Factory Pattern** (never import SQLite drivers directly)
7. **Update docs** when making architectural or pattern changes
8. **Ask for clarification** when documentation is unclear
9. **Always branch off main** before starting work (never commit directly to main)

### ❌ DON'T

1. **Import `db` directly** (use repositories instead - see constitution)
2. **Write to Calibre database** (except ratings via `updateCalibreRating()`)
3. **Use global mocks in tests** (causes test isolation issues)
4. **Import SQLite directly** (always use Database Factory Pattern from patterns.md)
5. **Create new markdown files** without explicit user request
6. **Skip documentation** before making architectural changes
7. **Bypass the Repository Pattern** (violates constitution)
8. **Commit directly to main** (always use feature branches and PRs)

---

## 🔄 Decision Framework

When making a decision:

```
Need to understand project principles?
└─ Read .specify/memory/constitution.md

Need a code pattern?
└─ Read .specify/memory/patterns.md (10 patterns with examples)

Need to access Tome database?
├─ YES → Use repositories (lib/repositories/)
│        ├─ bookRepository, sessionRepository, etc.
│        └─ NEVER import db directly!
└─ NO  → Continue

Need to access Calibre database?
├─ Read-only → Use lib/db/calibre.ts
└─ Write (ratings only) → Use updateCalibreRating()

Is it documented?
├─ YES → Follow the documentation
└─ NO  → Check if similar pattern exists
         ├─ YES → Follow similar pattern
         └─ NO  → Ask user for guidance

Does it affect architecture?
├─ YES → Read docs/ARCHITECTURE.md first
└─ NO  → Proceed with established patterns

Writing tests?
├─ YES → Use setDatabase(testDb) and resetDatabase()
│        └─ See .specify/memory/patterns.md (Pattern 2)
└─ NO  → Continue

Is it a new feature?
├─ YES → Use SpecKit workflow (/speckit.specify → /speckit.plan → /speckit.tasks)
└─ NO  → Proceed following patterns
```

---

## ⚡ Quick Commands

```bash
# Development
bun install                    # Install dependencies
bun run dev                    # Start dev server (auto-sync enabled)
bun test                       # Run all tests (must pass 99+)
bun run build                  # Build for production

# Database
bunx drizzle-kit generate      # Generate migration from schema changes
bunx drizzle-kit push          # Apply migrations to database

# View documentation
cat .specify/memory/constitution.md   # Project principles
cat .specify/memory/patterns.md       # Code patterns
cat docs/ARCHITECTURE.md               # System architecture
cat docs/AI_CODING_PATTERNS.md         # Coding standards
cat docs/REPOSITORY_PATTERN_GUIDE.md   # Repository guide
```

---

## 📖 Learning Path

**For new AI assistants to this project:**

1. Read `AI_INSTRUCTIONS.md` (this file)
2. Read `.specify/memory/constitution.md` - Project principles
3. Read `.specify/memory/patterns.md` - Code patterns
4. Read `docs/ARCHITECTURE.md` - System design (Sections 1-4)
5. Read `docs/AI_CODING_PATTERNS.md` - Coding standards
6. Skim `docs/REPOSITORY_PATTERN_GUIDE.md`
7. Review `__tests__/README.md`
8. You're ready!

---

## 🆘 When Uncertain

If unsure about:
- **Project principles** → `.specify/memory/constitution.md`
- **Code patterns** → `.specify/memory/patterns.md`
- **Architecture** → `docs/ARCHITECTURE.md`
- **Coding standards** → `docs/AI_CODING_PATTERNS.md`
- **Repositories** → `docs/REPOSITORY_PATTERN_GUIDE.md`
- **Testing** → `__tests__/README.md`
- **Decisions** → `docs/ADRs/`
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
- **SQLite Libraries:** better-sqlite3 (Node.js) / bun:sqlite (Bun) - via Database Factory Pattern
- **Testing:** Bun test runner (99+ tests)
- **Test Isolation:** setDatabase() / resetDatabase() pattern

**See `docs/ARCHITECTURE.md` for complete details.**

---

## 📌 Remember

- **Documentation is the source of truth** - Follow it unless explicitly asked to change
- **Patterns exist for a reason** - Don't reinvent unless there's a clear problem
- **Tests must pass** - No exceptions (run `bun test`)
- **Ask when uncertain** - Better to clarify than to guess
- **Constitution defines principles** - Read `.specify/memory/constitution.md` first
- **Patterns provide implementations** - Use `.specify/memory/patterns.md` for code

---

**Last Updated:** 2025-11-24
**Project:** Tome (Book Tracker with Calibre Integration)
**Tech Stack:** SQLite + Drizzle ORM + Repository Pattern
**Architecture:** Routes → Services → Repositories (3-layer pattern)
