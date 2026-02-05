# Implementation Plan: Support Non-Calibre Books

**Branch**: `003-non-calibre-books` | **Date**: 2026-02-05 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-non-calibre-books/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Enable Tome to track books from multiple sources (manual entry, Hardcover, OpenLibrary) while preserving existing Calibre integration. Implements extensible provider architecture with federated search, source migration, and circuit breaker patterns. Foundation enables users to track physical books alongside digital Calibre library.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 18+ (dev) / Bun 1.x (production)  
**Primary Dependencies**: Next.js 16 (App Router), Drizzle ORM, SQLite  
**Storage**: SQLite (Tome DB + Calibre DB via factory pattern), JSON for provider configs  
**Testing**: Vitest (2000+ existing tests), Repository Pattern with test isolation  
**Target Platform**: Self-hosted Linux/Docker (Next.js server on port 3000)  
**Project Type**: Web application (Next.js full-stack)  
**Performance Goals**: 
- Federated search: <6 seconds (5s provider timeout + 1s processing)
- Library filtering: <3 seconds for 10k books
- Source migration: <2 seconds
- Circuit breaker overhead: <5ms per operation

**Constraints**: 
- Zero external service dependencies (must run in complete isolation)
- SQLite only (no Redis, Postgres, cloud APIs)
- Self-contained deployment (Docker single container)
- Calibre integration must remain read-only except ratings/tags
- All existing Tome features must work identically for any book source

**Scale/Scope**: 
- Single-user deployments
- Libraries up to 10k books
- 4 built-in providers initially (Calibre, Manual, Hardcover, OpenLibrary)
- 15+ new API routes, 3+ new repositories, 5+ new services

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Verify compliance with principles from `.specify/memory/constitution.md`:

- [x] **Data Integrity First**: Schema changes via Drizzle migrations with companion migrations for data transformations. Source field is immutable (except via explicit migration). Uses Database Factory Pattern for all connections. NO writes to Calibre except ratings via `updateCalibreRating()`.
- [x] **Layered Architecture Pattern**: Follows Routes → Services → Repositories. New repositories: `providerRepository`, `providerConfigRepository`. Existing repositories extended for source filtering. NO direct db imports.
- [x] **Self-Contained Deployment**: All providers work in isolation. NO external service dependencies. Hardcover/OpenLibrary APIs are optional (graceful fallback to manual entry). Provider configs stored in SQLite. Uses existing SQLite infrastructure.
- [x] **User Experience Standards**: Smart defaults (source auto-set on creation). Source badges for visual distinction. Duplicate warnings with user choice. Preserves history (migration upgrades manual→external, never deletes). Federated search auto-falls back on failure.
- [x] **Observability & Testing**: Provider operations logged with Pino (search, fetch, circuit breaker state). Tests use real databases with `setDatabase()`. Repository pattern ensures test isolation. New tests for provider architecture, federated search, source migration.

**Violations**: NONE - Feature aligns with all constitutional principles.

**Additional Compliance Notes**:
- **Calibre as Source of Truth**: Calibre sync operations restricted to `source='calibre'` books only (FR-004, FR-005)
- **Complete History**: Source migrations are one-way and logged for audit (FR-016d, FR-021b)
- **Zero External Dependencies**: External providers are optional enhancements, not requirements (FR-020)
- **Local-First**: All provider configs stored in SQLite, no cloud dependencies (FR-014c)

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
# Web application structure (Next.js full-stack)

# New directories for this feature
lib/
├── providers/                          # NEW: Provider implementations
│   ├── base/
│   │   ├── IMetadataProvider.ts        # Provider interface
│   │   └── ProviderRegistry.ts         # Provider discovery/registration
│   ├── calibre.provider.ts             # Existing Calibre sync → provider
│   ├── manual.provider.ts              # Manual entry (no external API)
│   ├── hardcover.provider.ts           # Hardcover API integration
│   └── openlibrary.provider.ts         # OpenLibrary API integration
├── services/
│   ├── provider.service.ts             # NEW: Provider orchestration
│   ├── search.service.ts               # NEW: Federated search logic
│   ├── migration.service.ts            # NEW: Source migration workflows
│   └── circuit-breaker.service.ts      # NEW: Failure detection/recovery
├── repositories/
│   ├── provider-config.repository.ts   # NEW: Provider config CRUD
│   └── book.repository.ts              # EXTENDED: Source filtering

# API routes
app/api/
├── books/
│   └── route.ts                        # EXTENDED: Source filtering, manual creation
├── providers/
│   ├── route.ts                        # NEW: List providers, health status
│   ├── [providerId]/
│   │   ├── search/route.ts             # NEW: Single provider search
│   │   └── config/route.ts             # NEW: Provider config management
│   └── search/route.ts                 # NEW: Federated search endpoint
└── migration/
    └── [bookId]/route.ts               # NEW: Source migration endpoint

# Database schemas
lib/db/schema/
├── books.ts                            # EXTENDED: source, externalId fields
└── provider-configs.ts                 # NEW: Provider configuration table

# Frontend components
components/
├── providers/
│   ├── ProviderBadge.tsx               # NEW: Source indicators
│   ├── FederatedSearchModal.tsx        # NEW: Multi-provider search UI
│   ├── SourceMigrationDialog.tsx       # NEW: Upgrade manual→external
│   └── DuplicateWarning.tsx            # NEW: Cross-source duplicate detection
└── books/
    └── BookFilters.tsx                 # EXTENDED: Source filter

# Tests
__tests__/
├── providers/
│   ├── provider-registry.test.ts       # NEW: Registry tests
│   ├── circuit-breaker.test.ts         # NEW: Failure handling
│   └── federated-search.test.ts        # NEW: Multi-provider search
├── services/
│   ├── provider.service.test.ts        # NEW: Provider orchestration
│   └── migration.service.test.ts       # NEW: Source migration
└── repositories/
    ├── provider-config.repository.test.ts  # NEW: Config CRUD
    └── book.repository.test.ts         # EXTENDED: Source filtering

# Migrations
drizzle/
└── 00XX_multi_source_support.sql       # NEW: Schema migration (source, externalId)
lib/migrations/
└── 00XX_populate_source_field.ts       # NEW: Companion migration (set source='calibre')
```

**Structure Decision**: Follows existing Next.js App Router web application structure with clear separation between provider implementations (`lib/providers/`), business logic (`lib/services/`), and data access (`lib/repositories/`). Uses established Repository Pattern and Service Layer patterns from existing codebase.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

**Status**: NOT APPLICABLE - No constitutional violations detected. All complexity is justified by feature requirements and follows established patterns.
