# Implementation Plan: Annual Reading Goals

**Branch**: `002-annual-reading-goals` | **Date**: 2025-11-27 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-annual-reading-goals/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

The Annual Reading Goals feature allows users to set yearly book reading targets, automatically tracks progress against those goals using existing book completion data, and displays progress on a dedicated Goals page with visualizations. Users can create/edit goals for current and future years, view historical goals (read-only), see month-by-month charts, and browse completed books for each year. The system calculates whether users are on track, ahead, or behind pace measured in books.

**Technical Approach**: Extend existing SQLite database with a new `reading_goals` table. Query `reading_sessions.completedDate` to calculate progress on-demand (no caching). Add dedicated Goals page with year selector, progress widget, monthly chart, and completed books section. Implement modal-based goal management. Reuse existing BookGrid component for displaying completed books. Follow existing layered architecture (Routes → Services → Repositories) with Pino logging and Bun test framework.

## Technical Context

**Language/Version**: TypeScript 5 with Bun runtime
**Primary Dependencies**: Next.js 14, React 18, Drizzle ORM 0.44, date-fns 3.3, Pino 9.3
**Storage**: SQLite via better-sqlite3 and Drizzle ORM (single local database file)
**Testing**: Bun test framework with @testing-library/react
**Target Platform**: Self-hosted web application (Node.js/Bun server + browser client)
**Project Type**: Web application (Next.js App Router with frontend + API routes)
**Performance Goals**: Goals page loads in <2s, progress updates reflect within 2s, completed books section displays in <1s
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
└── goals/
    └── page.tsx                    # Goals page with year selector, chart, and books

components/
├── ReadingGoalWidget.tsx           # Progress widget for goals page
├── ReadingGoalForm.tsx             # Create/edit goal form (modal)
├── ReadingGoalChart.tsx            # Month-by-month bar chart
├── CompletedBooksSection.tsx       # Expandable section with BookGrid
├── YearSelector.tsx                # Year dropdown for goals page
├── GoalsPagePanel.tsx              # Main container for goals page
└── CreateGoalPrompt.tsx            # Empty state prompt

# Testing
__tests__/
├── services/
│   └── reading-goals.service.test.ts
├── repositories/
│   └── reading-goals.repository.test.ts
├── components/
│   ├── ReadingGoalWidget.test.tsx
│   ├── ReadingGoalChart.test.tsx
│   └── CompletedBooksSection.test.tsx
└── integration/
    └── api/
        └── reading-goals.test.ts
```

**Structure Decision**: Using Next.js App Router pattern with API routes for backend logic and React Server Components + Client Components for frontend. Follows existing monorepo structure with separate `lib/` (shared backend logic), `app/` (pages + API routes), and `components/` (UI). Testing mirrors source structure under `__tests__/`.

## Complexity Tracking

> **No violations to justify** - Feature complies with all constitution principles without needing exceptions.
