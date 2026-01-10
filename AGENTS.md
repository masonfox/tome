# Agent Instructions for Tome

**Universal guidance for all AI coding assistants working on the Tome project.**


### Essential Documentation (Read in Order)

**Read these documents before writing any code:**

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
3. **Agent Pointers** (this file) - Workflow and quick reference

---

## 📚 Documentation Guide

### 1. Constitution ⭐ `.specify/memory/constitution.md`

**Project principles and governance.**

Contains:
- Data Integrity First (Calibre read-only with ratings exception)
- Layered Architecture Pattern (Routes → Services → Repositories)
- Self-Contained Deployment (SQLite only, zero external deps)
- User Experience Standards (smart defaults, temporal validation)
- Observability & Testing (Pino logging, real database tests)

**Read this first to understand the rules.**

### 2. Patterns 🔑 `.specify/memory/patterns.md`

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

### 3. Architecture 📐 `docs/ARCHITECTURE.md`

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

### 4. Coding Standards ⚠️ `docs/AI_CODING_PATTERNS.md`

**Critical patterns and common AI mistakes.**

Contains:
- Repository Pattern enforcement (NEVER import db directly)
- Test isolation patterns (setDatabase, resetDatabase)
- Calibre write operations (ratings only via updateCalibreRating)
- Code style guidelines (TypeScript, React, naming)
- Common AI mistakes to avoid
- What to DO and what NOT to do

**Read this before writing any code.**

### 5. Additional Documentation

| Document | Purpose |
|----------|---------|
| `docs/REPOSITORY_PATTERN_GUIDE.md` | Complete guide to Repository Pattern |
| `__tests__/README.md` | Testing patterns (99+ tests) |
| `docs/ADRs/` | Architecture Decision Records |
| `docs/SPECKIT_WORKFLOW.md` | SpecKit feature development workflow |

---

## 📋 Essential Rules

### ✅ DO

1. **Read `.specify/memory/constitution.md`** to understand project principles
2. **Use `.specify/memory/patterns.md`** for implementation patterns
3. **Use repositories** for all Tome database access (`bookRepository`, etc.)
4. **Use `setDatabase()` and `resetDatabase()`** in tests for isolation
5. **Run `npm test`** before completing tasks (all 99+ tests must pass)
6. **Follow the Database Factory Pattern** (never import SQLite drivers directly)
7. **Update docs** when making architectural or pattern changes
8. **Ask for clarification** when documentation is unclear
9. **Always branch off develop** before starting work (never commit directly to develop or main)
10. **Create PRs to develop branch** (use `gh pr create --base develop`)

### ❌ DON'T

1. **Import `db` directly** (use repositories instead - see constitution)
2. **Write to Calibre database** (except ratings via `updateCalibreRating()`)
3. **Use global mocks in tests** (causes test isolation issues)
4. **Import SQLite directly** (always use Database Factory Pattern from patterns.md)
5. **Create new markdown files** without explicit user request
6. **Skip documentation** before making architectural changes
7. **Bypass the Repository Pattern** (violates constitution)
8. **Commit directly to main or develop** (always use feature branches and PRs)
9. **Create PRs to main** (always target develop branch with `--base develop`)

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

## 🛠️ Tool-Specific Features

### GitHub Copilot

**Context-aware inline completion hints:**

```typescript
// ✅ Correct - Use repository
import { bookRepository } from "@/lib/repositories/book.repository";
const books = await bookRepository.findWithFilters({ status: "reading" }, 50, 0);

// ❌ Wrong - Direct db access
import { db } from "@/lib/db/sqlite";
const books = db.select().from(books).all();

// ✅ Correct - Test isolation
beforeEach(async () => {
  setDatabase(testDb);
  resetDatabase();
});

// ✅ Correct - Use factory
import { createDatabase } from "@/lib/db/factory";
const { db, sqlite, runtime } = createDatabase({ path, schema, wal: true });
```

**What NOT to suggest:** Direct `db` imports, direct SQLite imports, global test mocks, `any` types

**What TO suggest:** Repository methods, Database Factory Pattern, test isolation, proper TypeScript

### Claude Code

**SpecKit Slash Commands for feature development:**

- `/speckit.specify [feature]` - Create feature specification
- `/speckit.plan` - Generate implementation plan with constitution checks
- `/speckit.tasks` - Break down into actionable tasks
- `/speckit.implement` - Execute implementation
- `/speckit.clarify` - Identify underspecified areas
- `/speckit.checklist` - Generate custom checklist
- `/speckit.analyze` - Cross-artifact consistency analysis

**See `docs/SPECKIT_WORKFLOW.md` for complete workflow.**

**TodoWrite Tool:** Use for complex tasks (3+ steps). Keep only ONE todo in_progress at a time.

**Task Tool:** Use to spawn specialized agents (Explore, Plan, etc.). Send parallel tool calls in a single message.

### OpenCode

**Session Management:** Use TodoWrite to track progress. Mark tasks as completed immediately after finishing.

**Parallel Execution:** When multiple independent tasks exist, make all tool calls in a single response.
i
---

## Development Workflow - ALL AGENTS: Claude and Opencode
**ALWAYS follow these planning steps**:

1. When finalizing planned work, ALWAYS create a plan file in /docs/plans, including context/background, phased work and uniquely identifiable tasks.
2. As you work, pull and announce each task item that you're working on
3. When you complete a task, announce it and update that task as done in the plan file
4. Mark phases complete when all tasks are done
5. Unless there are questions that need answered to inform the next phase of development, continue to the next phase of development without user prompt

Additional notes:

* The /docs/plans directory IS NOT versioned with git on purpose. Therefore, do not try to `git add` or `git commit` changes to them.
* You NEVER need to run the dev server - `npm run dev`. It's always running in the background. Therefore, if you need to test APIs, use localhost:3000
* Prefer direct API tests via curling localhost:3000 API endpoints
* Prefer direct database queries when troubleshooting problems. The database is always in /data/tome.db

---

## 🔄 Git Workflow

### Branching Policy

**NEVER commit directly to main or develop.** Always work on feature branches:

1. **Starting Work:**
   - Create a new branch from develop: `git checkout -b feature/descriptive-name`
   - Branch naming conventions: `feature/`, `fix/`, `docs/`, `refactor/`, `hotfix`
   - Always branch off develop, never off main or other feature branches

2. **During Development:**
   - Commit regularly as you complete phases of work
   - Each commit should represent a logical unit of work
   - Write meaningful commit messages following repository style (check `git log`)
   - Commits should explain WHY, not just WHAT

3. **Completing Work:**
   - Push branch to remote: `git push -u origin branch-name`
   - Create pull request to merge into **develop** (use `gh pr create --base develop`)
   - Never merge directly to develop or main without PR
   - All PRs must target the `develop` branch

### Commit Guidelines

- **Commit early and often** during development phases
- Each commit should compile and ideally pass tests
- Follow existing commit message style and conventions
- Include co-authorship footer when working with AI assistants
- Stage only relevant files (avoid `git add .` without review)

### Creating Commits (Claude/OpenCode)

Only create commits when user requests. Follow the Git Safety Protocol:

- NEVER update git config
- NEVER run destructive git commands without explicit request
- Run `git status` and `git diff` in parallel before committing
- Draft meaningful commit message following repository style
- Include co-authorship footer in commit message

### Creating Pull Requests (Claude/OpenCode)

When user asks for PR:

1. Run `git status`, `git diff`, and `git log` in parallel
2. Analyze ALL commits (not just latest) on the branch
3. Draft PR title and summary covering all changes
4. Push with `-u` if needed
5. Use `gh pr create --base develop` with title and body (HEREDOC format)
6. Return PR URL to user

---

## 🎬 Landing the Plane (Session Completion) - ALL AGENTS: Claude and Opencode

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - use the respective plan in /docs/plans.

2. **Run quality gates** (if code changed) - Tests, linters, builds
   ```bash
   npm test                # All tests must pass
   npm run build           # Must build successfully
   ```

3. **Update issue status** - Close finished work, update in-progress items in the appropriate /docs/plans file.

4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   git push
   git status  # MUST show "up to date with origin"
   ```

5. **Clean up** - Clear stashes, prune remote branches
   ```bash
   git stash clear         # If any stashes exist
   git remote prune origin # Clean up deleted branches
   ```

6. **Verify** - All changes committed AND pushed
   ```bash
   git status              # Should show "nothing to commit, working tree clean"
   git log origin/$(git branch --show-current)..HEAD  # Should show no commits
   ```

7. **Hand off** - Provide context for next session
   - Summarize completed work
   - List any remaining tasks
   - Note any blockers or decisions needed

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds

---

## ⚡ Quick Commands

```bash
# Development
npm install                        # Install dependencies
npm test                           # Run all tests (must pass 2000+)
npm run build                      # Build for production

# Database
bunx drizzle-kit generate          # Generate migration from schema changes
bunx drizzle-kit push              # Apply migrations to database

# View documentation
cat .specify/memory/constitution.md   # Project principles
cat .specify/memory/patterns.md       # Code patterns
cat docs/ARCHITECTURE.md               # System architecture
cat docs/AI_CODING_PATTERNS.md         # Coding standards
cat docs/REPOSITORY_PATTERN_GUIDE.md   # Repository guide
```

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
| **Feature development** | `docs/SPECKIT_WORKFLOW.md` |

---

## 🏗️ Tech Stack Summary

- **Framework:** Next.js 16 (App Router)
- **Runtime:** Node.js
- **Package Manager:** npm
- **Databases:**
  - **Tome DB:** SQLite + Drizzle ORM
  - **Calibre DB:** SQLite
- **Data Access:** Repository Pattern (lib/repositories/)
- **SQLite Libraries:** better-sqlite3 (Node.js) via Database Factory Pattern
- **Testing:** Vitest test runner (2000+ tests)
- **Test Isolation:** setDatabase() / resetDatabase() pattern

**See `docs/ARCHITECTURE.md` for complete details.**

---

## 📖 Learning Path

**For new AI assistants to this project:**

1. Read `AGENTS.md` (this file) - Quick start and workflow
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
- **Workflow** → This file (AGENTS.md)
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

## 📌 Remember

- **Beads for issue tracking** - Use `bd` commands for workflow
- **Documentation is the source of truth** - Follow it unless explicitly asked to change
- **Constitution defines principles** - Read `.specify/memory/constitution.md` first
- **Patterns provide implementations** - Use `.specify/memory/patterns.md` for code
- **Tests must pass** - No exceptions (run `npm test`)
- **Land the plane** - Always push to remote before ending session
- **Ask when uncertain** - Better to clarify than to guess

---

**Last Updated:** 2026-01-06  
**Project:** Tome (Book Tracker with Calibre Integration)  
**Tech Stack:** SQLite + Drizzle ORM + Repository Pattern  
**Architecture:** Routes → Services → Repositories (3-layer pattern)
