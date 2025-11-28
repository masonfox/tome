# Implementation Plan: Annual Reading Goals

**Branch**: `002-annual-reading-goals` | **Date**: 2025-11-27 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-annual-reading-goals/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

The Annual Reading Goals feature allows users to set yearly book reading targets, automatically tracks progress against those goals using existing book completion data, and displays progress with pace indicators on the dashboard. Users can create/edit goals for current and future years, view historical goals (read-only), and filter their library by completion year. The system calculates whether users are on track, ahead, or behind pace, and projects finish dates when sufficient data exists.

**Technical Approach**: Extend existing SQLite database with a new `reading_goals` table. Query `reading_sessions.completedDate` to calculate progress on-demand (no caching). Add dashboard widget for current year's goal, Settings UI for goal management, and library filter for year-based browsing. Follow existing layered architecture (Routes → Services → Repositories) with Pino logging and Bun test framework.

## Technical Context

**Language/Version**: TypeScript 5 with Bun runtime
**Primary Dependencies**: Next.js 14, React 18, Drizzle ORM 0.44, date-fns 3.3, Pino 9.3
**Storage**: SQLite via better-sqlite3 and Drizzle ORM (single local database file)
**Testing**: Bun test framework with @testing-library/react
**Target Platform**: Self-hosted web application (Node.js/Bun server + browser client)
**Project Type**: Web application (Next.js App Router with frontend + API routes)
**Performance Goals**: Dashboard loads in <2s, progress updates reflect within 2s, year filter returns results in <1s
**Constraints**: Local-first (no cloud dependencies), must work with SQLite only, read-only access to existing reading_sessions data
**Scale/Scope**: Single user or small household, up to 1000+ completed books per user, historical goals retained indefinitely

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Verify compliance with principles from `.specify/memory/constitution.md`:

- [x] **Data Integrity First**: Feature uses Drizzle migrations for new `reading_goals` table. Does NOT modify existing Calibre DB or reading_sessions schema. Uses read-only queries against `reading_sessions.completedDate` for progress calculation.
- [x] **Layered Architecture Pattern**: Follows Routes → Services → Repositories pattern. New `reading-goals.repository.ts`, `reading-goals.service.ts`, and API route `/api/reading-goals` follow existing patterns.
- [x] **Self-Contained Deployment**: No external services required (no Redis, no queues, no cloud APIs). All calculations performed in-application using SQLite queries.
- [x] **User Experience Standards**: Provides smart defaults (current year auto-selected), validates temporal relationships (past years read-only), preserves history (historical goals never deleted).
- [x] **Observability & Testing**: Uses Pino structured logging for goal CRUD operations and progress calculations. Tests use real database with existing `setDatabase()` pattern for isolation.

**Violations**: None. Feature fully complies with all constitution principles.

## Project Structure

### Documentation (this feature)

```text
specs/002-annual-reading-goals/
├── spec.md              # Feature specification
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (research findings)
├── data-model.md        # Phase 1 output (database schema)
├── quickstart.md        # Phase 1 output (developer onboarding)
├── contracts/           # Phase 1 output (API contracts)
│   └── api-reading-goals.yaml
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
# Web application structure (Next.js App Router)

# Backend/API Layer
app/api/
└── reading-goals/
    └── route.ts                    # GET, POST, PATCH /api/reading-goals

lib/
├── db/
│   ├── schema/
│   │   ├── reading-goals.ts        # New schema for reading_goals table
│   │   └── index.ts                # Export new schema
│   └── migrations/
│       └── XXXX_add_reading_goals.sql
├── repositories/
│   ├── reading-goals.repository.ts # Data access for reading_goals
│   └── index.ts                    # Export new repository
└── services/
    ├── reading-goals.service.ts    # Business logic for goals & progress
    └── index.ts                    # Export new service

# Frontend Layer
app/
├── settings/
│   └── page.tsx                    # Add Reading Goals section
├── dashboard/
│   └── page.tsx                    # Update with ReadingGoalWidget
└── library/
    └── page.tsx                    # Add year filter

components/
├── ReadingGoalWidget.tsx           # Dashboard widget for current year goal
├── ReadingGoalForm.tsx             # Create/edit goal form (Settings)
├── ReadingGoalsList.tsx            # List of all goals (Settings)
└── YearCompletionFilter.tsx        # Library filter dropdown

# Testing
__tests__/
├── services/
│   └── reading-goals.service.test.ts
├── repositories/
│   └── reading-goals.repository.test.ts
└── components/
    ├── ReadingGoalWidget.test.tsx
    └── YearCompletionFilter.test.tsx
```

**Structure Decision**: Using Next.js App Router pattern with API routes for backend logic and React Server Components + Client Components for frontend. Follows existing monorepo structure with separate `lib/` (shared backend logic), `app/` (pages + API routes), and `components/` (UI). Testing mirrors source structure under `__tests__/`.

## Complexity Tracking

> **No violations to justify** - Feature complies with all constitution principles without needing exceptions.
