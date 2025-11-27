# Tome Documentation Index

Welcome to the Tome project documentation! This directory contains comprehensive guides for understanding, developing, and maintaining the application.

## 👋 For AI Coding Assistants

If you're an AI coding assistant (Claude Code, GitHub Copilot, Cursor, etc.), **start here!**

### Required Reading Before Making Changes

1. **Coding Patterns** → [`AI_CODING_PATTERNS.md`](./AI_CODING_PATTERNS.md) ⭐ **START HERE**
2. **Architecture** → [`ARCHITECTURE.md`](./ARCHITECTURE.md) - System design, patterns, and code examples
3. **Detailed Patterns** → [`../.specify/memory/patterns.md`](../.specify/memory/patterns.md) - Implementation patterns
4. **Testing Guide** → [`../__tests__/README.md`](../__tests__/README.md)

**[`AI_CODING_PATTERNS.md`](./AI_CODING_PATTERNS.md) is your primary reference** - it contains all critical patterns, code styles, and rules including:
- Database factory pattern (THE most important pattern)
- Test isolation patterns
- Code style guidelines
- What to DO and what NOT to do

---

## 📚 Documentation Files

### Architecture Decision Records (ADRs)

#### [ADR-001-MONGODB-TO-SQLITE-MIGRATION.md](./ADR-001-MONGODB-TO-SQLITE-MIGRATION.md) ⭐ **NEW**
**MongoDB to SQLite migration details**

Covers:
- Why we migrated from MongoDB to SQLite
- Why Drizzle ORM over Prisma
- Schema design and constraints
- Repository pattern implementation
- Migration process (6 phases)
- User migration guide

**When to read:**
- Understanding the current database architecture
- Before working with the database
- When curious about the migration decision

### Core Architecture

#### [ARCHITECTURE.md](./ARCHITECTURE.md)
**Complete architecture, patterns, and code examples**

Covers:
- System overview and technology stack
- Database schemas with detailed field definitions
- Calibre integration and sync mechanism
- Complete API endpoint reference
- Frontend architecture (Next.js App Router)
- Key features (re-reading, progress, streaks, rating sync)
- Development patterns with code examples
- Data flow examples
- File organization

**When to read:**
- Before making architectural changes
- When adding new features
- When troubleshooting system-level issues
- To understand data relationships
- Looking for code examples

---

#### [patterns.md](../.specify/memory/patterns.md)
**Reusable implementation patterns with working code**

Covers:
- 10 production-tested implementation patterns
- Database factory pattern
- Repository pattern examples
- Service layer patterns
- Test isolation patterns
- Complete code examples from the codebase

**When to read:**
- Implementing similar features
- Need copy-paste ready code examples
- Understanding established patterns

---

### AI Assistant Guides

#### [AI_CODING_PATTERNS.md](./AI_CODING_PATTERNS.md)
**Single source of truth for coding patterns and styles** ⭐

Covers:
- **Critical database factory pattern** (SQLite driver abstraction)
- Test isolation patterns and anti-patterns
- Code style guidelines (TypeScript, React, naming)
- Common imports and database patterns
- What to DO and what NOT to do
- API route patterns
- Typical workflows for common tasks

**When to read:**
- **ALWAYS read this before writing any code**
- When unsure about code style
- When adding tests
- When working with databases
- Before suggesting architectural changes

---

### Documentation Guides

#### [DOCUMENTATION_GUIDE.md](./DOCUMENTATION_GUIDE.md)
**How to write and maintain documentation**

Covers:
- Documentation structure and organization
- When to update docs
- Writing standards and best practices
- Documentation maintenance

**When to read:**
- Before adding or updating documentation
- When documentation feels unclear
- To understand doc organization

---

### Feature Guides

#### [DARK_MODE_SETUP.md](./DARK_MODE_SETUP.md)
**Dark mode implementation details**

Covers:
- How dark mode is implemented
- Theme switching mechanism
- CSS variable usage

**When to read:**
- Working on UI theme features
- Troubleshooting dark mode issues

---

### User and Operations Guides

#### [DEPLOYMENT.md](./DEPLOYMENT.md)
**Comprehensive deployment guide**

Covers:
- Docker deployment options (GHCR, Docker Compose, build from source)
- Environment variables and configuration
- Volume management and backups
- Database migrations in production
- Production best practices and security
- Monitoring and common issues

**When to read:**
- Deploying Tome to production
- Setting up Docker containers
- Configuring production environments
- Troubleshooting deployment issues

---

#### [DATABASE.md](./DATABASE.md)
**Database management and operations**

Covers:
- Database commands (migrations, backups, restore)
- Data models and schema details
- Backup strategies and maintenance
- Migration system details
- Advanced operations (export, import, querying)
- Best practices

**When to read:**
- Managing database schema
- Creating backups
- Running migrations
- Understanding data models
- Database troubleshooting

---

#### [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
**Common issues and solutions**

Covers:
- Calibre database issues
- Tome database problems
- Port conflicts
- Docker-specific issues
- Development issues
- Preventive measures

**When to read:**
- Encountering errors or issues
- Database not found errors
- Migration failures
- Permission problems
- Before deploying to production

---

#### [CLEANUP_OPERATIONS.md](./CLEANUP_OPERATIONS.md)
**Maintenance and cleanup procedures**

Covers:
- Database cleanup operations
- Data maintenance tasks
- System housekeeping

**When to read:**
- Performing database maintenance
- Cleaning up test data
- System administration tasks

---

### Technical Implementation Guides

#### [sqlite-driver-consolidation.md](./sqlite-driver-consolidation.md)
**Database factory pattern implementation**

Covers:
- Why we need both bun:sqlite and better-sqlite3
- Database factory pattern design
- Implementation details and code reduction metrics
- Testing results

**When to read:**
- Understanding SQLite driver architecture
- Before modifying database connection logic
- When curious about dual-driver approach

---

## 🧪 Testing Documentation

Located at: [`../__tests__/README.md`](../__tests__/README.md)

**Comprehensive testing guide**

Covers:
- Test structure (99 tests across 7 files)
- Test isolation best practices
- Database testing with mongodb-memory-server
- Common pitfalls and solutions

**When to read:**
- Before writing new tests
- When tests are failing
- To understand test patterns

---

## 🚀 Quick Start for Developers

### First Time Setup

1. **Read the architecture:** Start with `ARCHITECTURE.md` sections 1-3
2. **Check environment:** Review section 8 "Key Configuration Files"
3. **Run the app:** Follow section 12 "Development Workflow"

### Making Changes

1. **Find relevant docs:** Use this index to locate documentation
2. **Read existing patterns:** Check `ARCHITECTURE.md` Section 8 or `.specify/memory/patterns.md`
3. **Make changes:** Follow established patterns
4. **Update docs:** If you changed architecture or patterns
5. **Test:** Run `bun test` to ensure 99 tests pass

### Common Tasks

| Task | Documentation |
|------|---------------|
| Add a new API endpoint | `ARCHITECTURE.md` Section 4 |
| Add a new database model | `ARCHITECTURE.md` Section 3 |
| Work with Calibre data | `ARCHITECTURE.md` Section 3 |
| Add a new page | `ARCHITECTURE.md` Section 4 |
| Write tests | `../__tests__/README.md` |
| Update documentation | `DOCUMENTATION_GUIDE.md` |
| Deploy to production | `DEPLOYMENT.md` |
| Manage database | `DATABASE.md` |
| Fix issues | `TROUBLESHOOTING.md` |

---

## 🎯 Key Technologies

Understanding these is essential for working on Tome:

| Technology | Purpose | Documentation |
|------------|---------|---------------|
| **Next.js 14** | Framework (App Router) | `ARCHITECTURE.md` Section 4 |
| **SQLite** | Tracking data storage | `ADR-001-MONGODB-TO-SQLITE-MIGRATION.md` |
| **SQLite** | Calibre library (read-only) | `ARCHITECTURE.md` Section 3 |
| **Drizzle ORM** | Type-safe SQLite ORM | `ADR-001-MONGODB-TO-SQLITE-MIGRATION.md` |
| **Database Factory** | SQLite driver abstraction | `ARCHITECTURE.md` Section 6 |
| **Bun** | Package manager & runtime | `ARCHITECTURE.md` Section 2 |
| **Repository Pattern** | Data access layer | `ADR-001-MONGODB-TO-SQLITE-MIGRATION.md` |

---

## 📖 Documentation Reading Order

### For New Developers

1. Start: `ARCHITECTURE.md` - Overview and Sections 1-2
2. Understand data: `ARCHITECTURE.md` - Section 3 (Database Models)
3. Learn Calibre: `ARCHITECTURE.md` - Section 3 (Calibre Database)
4. API structure: `ARCHITECTURE.md` - Section 4
5. Code examples: `ARCHITECTURE.md` - Section 8 or `.specify/memory/patterns.md`
6. Testing: `../__tests__/README.md`

### For Specific Tasks

**Adding a Feature:**
- `ARCHITECTURE.md` (relevant sections)
- `.specify/memory/patterns.md` (similar examples)
- `../__tests__/README.md` (testing patterns)

**Fixing a Bug:**
- `ARCHITECTURE.md` (understand affected component)
- `.specify/memory/patterns.md` (check patterns)

**Documentation Updates:**
- `DOCUMENTATION_GUIDE.md` (standards and structure)

---

## 🔍 Search Tips

### Finding Information

1. **Start with this index** to locate the right document
2. **Use your editor's search** (`Ctrl+F` or `Cmd+F`) within documents
3. **Check the Quick Reference** for code examples
4. **Refer to Architecture** for design decisions

### Common Searches

| Looking for... | Check... |
|----------------|----------|
| "How do I query books?" | `.specify/memory/patterns.md` |
| "API endpoint structure" | `ARCHITECTURE.md` Section 4 |
| "Database schema" | `ARCHITECTURE.md` Section 3 |
| "Calibre sync flow" | `ARCHITECTURE.md` Section 3 |
| "Component patterns" | `.specify/memory/patterns.md` |
| "Test examples" | `../__tests__/README.md` |
| "Docker deployment" | `DEPLOYMENT.md` |
| "Database management" | `DATABASE.md` |
| "Error troubleshooting" | `TROUBLESHOOTING.md` |

---

## 🛠️ Maintaining Documentation

Documentation should evolve with the codebase:

### When to Update

- **Architecture changes** → Update `ARCHITECTURE.md`
- **New patterns** → Add to `.specify/memory/patterns.md`
- **Test changes** → Update `../__tests__/README.md`
- **New features** → Update relevant sections

### How to Update

See [`DOCUMENTATION_GUIDE.md`](./DOCUMENTATION_GUIDE.md) for:
- Writing standards
- Structure guidelines
- Update process
- Review checklist

---

## 💡 Getting Help

### Documentation Not Clear?

1. Check if there's a related doc you missed
2. Search for keywords across documentation files
3. Ask for clarification (human developers or AI assistants)
4. Suggest documentation improvements

### Missing Documentation?

If you notice gaps:
1. Document the missing information
2. Follow patterns in `DOCUMENTATION_GUIDE.md`
3. Submit updates

---

## 📋 Documentation Checklist

Use this when making significant changes:

- [ ] Read relevant architecture documentation
- [ ] Understand existing patterns
- [ ] Make your changes following patterns
- [ ] Update documentation if architecture changed
- [ ] Run tests (`bun test`)
- [ ] Verify documentation accuracy

---

## 📞 Quick Reference

```bash
# View documentation
cat docs/README.md                          # This file
cat docs/ARCHITECTURE.md                    # Architecture
cat .specify/memory/patterns.md            # Code patterns

# Development
bun install                                 # Install dependencies
bun run dev                                 # Start dev server
bun test                                    # Run tests (99 tests)
bun run build                               # Build production

# Documentation location
docs/                                       # All documentation
__tests__/README.md                         # Test documentation
.claude/instructions.md                     # Claude Code guidance
.github/copilot-instructions.md            # Copilot guidance
```

---

**Last Updated:** 2025-11-27
**Documentation Version:** 1.2 (Documentation Reorganization)
**Project:** Tome (Book Tracker)

**Major Changes in v1.2:**
- Added DEPLOYMENT.md for comprehensive deployment guide
- Added DATABASE.md for database management operations
- Added TROUBLESHOOTING.md for common issues and solutions
- Streamlined main README.md to focus on getting started
- Organized documentation into clear user/operations guides
