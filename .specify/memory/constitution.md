<!--
SYNC IMPACT REPORT - Constitution Update
Generated: 2025-11-24

Version Change: NEW → 1.0.0 (Initial constitution - based on /docs review)

Principles Defined (grounded in actual documented practices):
  1. Data Integrity First - Calibre read-only with ratings exception (ADR-002), Drizzle migrations, factory pattern
  2. Layered Architecture Pattern - Routes → Services → Repositories (REPOSITORY_PATTERN_GUIDE.md, ADR-004)
  3. Self-Contained Deployment - SQLite only, zero external deps (ADR-001 MongoDB migration)
  4. User Experience Standards - Smart defaults, temporal validation, preserved history (BOOK_TRACKER_ARCHITECTURE.md)
  5. Observability & Testing - Pino structured logging, real database tests with setDatabase() (LOGGING_GUIDE.md, AI_CODING_PATTERNS.md)

Sections Added:
  - Core Principles (5 principles grounded in actual codebase patterns)
  - Development Workflow (Migration Safety, Testing Gates, Commit Practices)
  - Governance (Amendment Procedure, Compliance Verification)

Templates Updated:
  ✅ plan-template.md - Constitution Check section updated with specific validation questions
  ✅ spec-template.md - Validated (no changes needed)
  ✅ tasks-template.md - Validated (no changes needed)
  ✅ Command files - Validated (no agent-specific references)

Documentation Sources Referenced:
  - ADR-001-MONGODB-TO-SQLITE-MIGRATION.md
  - ADR-002-RATING-ARCHITECTURE.md
  - ADR-004-BACKEND-SERVICE-LAYER-ARCHITECTURE.md
  - REPOSITORY_PATTERN_GUIDE.md
  - AI_CODING_PATTERNS.md
  - LOGGING_GUIDE.md
  - BOOK_TRACKER_ARCHITECTURE.md

Follow-up TODOs:
  - None - all principles reflect actual documented practices

-->

# Tome Constitution

## Core Principles

### I. Data Integrity First

**Rule**: All database operations MUST protect data integrity and prevent corruption.

Requirements:
- Calibre database is read-only with ONE exception: ratings may be written via `updateCalibreRating()` for bidirectional sync
- Rating writes MUST only touch `ratings` and `books_ratings_link` tables (never `books`, `authors`, `series`, `tags`)
- All Calibre writes MUST use the approved abstraction in `lib/db/calibre-write.ts`
- Tome SQLite database MUST use Drizzle ORM with foreign keys, CHECK constraints, and unique indexes
- Database connections MUST use the factory pattern (`createDatabase()`) for runtime-appropriate driver selection
- All schema changes MUST go through Drizzle migrations (never direct ALTER TABLE)

**Rationale**: Tome integrates with Calibre's library, which is the user's primary book collection. The read-only policy protects metadata integrity while allowing ratings to sync bidirectionally (Calibre's expected behavior per ADR-002). The Tome tracking database contains irreplaceable user reading history protected through Drizzle's migration system and SQLite's ACID guarantees.

### II. Layered Architecture Pattern

**Rule**: Data access MUST follow the documented three-layer pattern: Routes → Services → Repositories.

Requirements:
- Route handlers MUST be thin (HTTP concerns only) and delegate to Service Layer
- Service Layer MUST contain business logic, validation, and orchestration
- Repository Layer MUST handle all database access (never bypass repositories)
- Never use raw Drizzle queries outside repositories (use `bookRepository`, `sessionRepository`, etc.)
- Complex client pages MUST use Client Service Layer pattern: `Page → Hook → ClientService → API`
- Database Factory pattern MUST be used for all connections (`createDatabase()` abstracts runtime detection)

**Rationale**: The Repository Pattern is the primary data access pattern (per REPOSITORY_PATTERN_GUIDE.md). This separation enables testing business logic without database mocks, provides consistent query interfaces, and isolates Drizzle ORM details. The Service Layer (added post-launch per ADR-004) centralizes business rules across multiple repositories.

### III. Self-Contained Deployment

**Rule**: The application MUST be deployable as a single unit with no external service dependencies.

Requirements:
- Single SQLite database for all tracking data (migrated from MongoDB per ADR-001)
- All dependencies bundled in deployment artifact (Bun runtime + Next.js)
- No required external services (no Redis, no message queues, no cloud services)
- Environment configuration via single `.env` file with sensible defaults
- Docker container MUST be fully self-contained (single volume for data persistence)
- Backup strategy: Copy `data/tome.db` file (no complex export procedures)

**Rationale**: Users want self-hosted solutions that "just work" without managing complex infrastructure (per README "Think: Goodreads/StoryGraph but powered by your personal Calibre library"). SQLite migration (ADR-001) eliminated MongoDB dependency, providing zero external dependencies, simpler deployment, better performance, data locality with Calibre, and easier backups.

### IV. User Experience Standards

**Rule**: The interface MUST provide smart defaults, temporal validation, and preserve user history.

Requirements:
- Smart defaults: Auto-set `startedDate` on first progress, `completedDate` at 100% completion
- Temporal validation: Reject backward progress with current date (prevent timeline inconsistencies)
- Allow backdated entries for legitimate use cases (book clubs, catch-up logging)
- Preserved history: Archive sessions on re-read (never delete), maintain reading counts
- Re-reading support: "Start Re-reading" creates new session while preserving complete history
- Rating integration: Book-level ratings (stored in Calibre), session-level notes (can differ per read)
- Error messages MUST be actionable (explain what happened and how to fix it)

**Rationale**: Reading tracking involves complex temporal relationships (start dates, progress timestamps, completion dates). Smart defaults reduce data entry burden. Temporal validation prevents user errors (e.g., backdating progress by accident). Preserved history respects that users re-read books and want to see their journey over time.

### V. Observability & Testing

**Rule**: All critical operations MUST be observable through structured logging, and testable with real databases.

Requirements:
- Structured logging via Pino: `getLogger().info({ bookId }, 'Action')` format
- Correlation IDs: Use `reqId` for request tracing across service boundaries
- Sensitive field redaction: `authorization`, `password`, `token` automatically redacted
- Development tooling: Drizzle Studio (database browser), detailed error pages
- Test with real databases: Use `setDatabase()` and `resetDatabase()` for isolation (never global module mocks)
- Test coverage: Run full test suite before completing tasks (`bun test` - 99+ tests)
- Database queries logged in development mode for N+1 detection

**Rationale**: When things go wrong, developers need clear visibility into what happened. Pino's structured logging (per LOGGING_GUIDE.md) enables rapid diagnosis with correlation across requests. Testing with real databases (per AI_CODING_PATTERNS.md) catches integration issues that mocks hide. Test isolation via `setDatabase()` prevents cross-test pollution.

## Development Workflow

### Migration Safety

- Migrations run automatically in Docker/production with retry logic (3 attempts)
- Migrations MUST run manually in development (explicit control)
- Automatic backups created before migrations (kept: last 3 backups)
- Pre-flight checks validate system state before migration execution
- Lock files prevent concurrent migrations (5-minute timeout)

### Testing Gates

- Comprehensive test suite (99+ tests) MUST pass before merging to main
- New features SHOULD include tests (unit + integration) but not strictly required
- Test with real databases using `setDatabase()` pattern (never global mocks)
- Test isolation MUST be maintained (use `resetDatabase()` between tests)
- Integration tests SHOULD validate end-to-end user journeys
- Service layer tests focus on business logic (77 unit tests for BookService, SessionService, ProgressService)

### Commit Practices

- Confirm to commit after each logical task completion
- Commit messages MUST follow: `type(scope): description`
- Types: feat, fix, refactor, test, docs, chore
- Breaking changes MUST include `BREAKING CHANGE:` in commit body

## Governance

### Amendment Procedure

1. Propose changes via GitHub issue tagged "constitution"
2. Changes MUST include:
   - Rationale (why needed)
   - Impact assessment (what breaks)
   - Migration plan (how to comply)
3. Approval required before amendment
4. Version bump according to semantic versioning:
   - MAJOR: Backward incompatible principle removal/redefinition
   - MINOR: New principle or materially expanded guidance
   - PATCH: Clarifications, wording fixes, non-semantic refinements

### Compliance Verification

- All PRs MUST verify compliance with Core Principles
- Code reviews MUST check for principle violations
- Constitution violations MUST be justified in PR description
- Unjustified complexity will be rejected

### Runtime Development Guidance

For agent-based development, runtime guidance is provided in:
- `.claude/instructions.md` - Claude Code specific patterns
- `.github/copilot-instructions.md` - GitHub Copilot specific patterns
- `AI_INSTRUCTIONS.md` - Universal AI assistant patterns

**Version**: 1.0.0 | **Ratified**: 2025-11-17 | **Last Amended**: 2025-11-24
