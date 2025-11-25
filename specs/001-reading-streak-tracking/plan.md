# Implementation Plan: Reading Streak Tracking Enhancement

**Branch**: `001-reading-streak-tracking` | **Date**: 2025-11-25 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-reading-streak-tracking/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Enhance the existing streak tracking system to provide comprehensive reading habit motivation through configurable thresholds, detailed analytics, and persistent progress visualization. The system tracks both current consecutive reading streaks and all-time longest streaks, with user-configurable daily page thresholds and rich analytics views showing historical reading patterns.

## Technical Context

**Language/Version**: TypeScript 5.x with Next.js 14.2 (React 18.3)
**Primary Dependencies**: Next.js, Drizzle ORM 0.44.7, better-sqlite3 12.4.1, date-fns 3.3.0, recharts 2.12.0
**Storage**: SQLite (local database via better-sqlite3)
**Testing**: Bun test with @testing-library/react 16.3.0
**Target Platform**: Web application (self-hosted, single-user mode)
**Project Type**: Web (Next.js frontend + backend API routes)
**Performance Goals**: <2s homepage load with streak display, <3s analytics view with 365 days of data
**Constraints**: Zero external service dependencies, all data stored locally, timezone-aware day boundaries
**Scale/Scope**: Single user per deployment, 365 days of historical progress data for analytics

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Verify compliance with principles from `.specify/memory/constitution.md`:

- [x] **Data Integrity First**: Feature enhances existing streak table with migrations. Uses Drizzle migrations for schema changes. Uses database factory pattern (`createDatabase()`). No Calibre DB writes.
- [x] **Layered Architecture Pattern**: Follows Routes → Services → Repositories pattern. Will use existing repository/service structure. No repository bypassing.
- [x] **Self-Contained Deployment**: No external services (Redis, queues, cloud) required. Works with just SQLite.
- [x] **User Experience Standards**: Provides smart defaults (1 page default threshold). Validates temporal relationships (timezone-aware day boundaries). Preserves history (no deletion of streak data).
- [x] **Observability & Testing**: Critical operations logged with Pino. Tests will use real databases with proper isolation.

**Violations** (if any): None. Feature fully compliant with all constitution principles.

## Project Structure

### Documentation (this feature)

```text
specs/001-reading-streak-tracking/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
# Web application structure
app/
├── page.tsx                          # Homepage (already displays streak)
├── streak/                           # NEW: Detailed streak analytics page
│   └── page.tsx
└── api/
    └── streak/                       # NEW: Streak API endpoints
        ├── route.ts                  # GET streak, UPDATE threshold
        └── analytics/
            └── route.ts              # GET analytics data

components/
├── StreakDisplay.tsx                 # EXISTS: Enhanced with threshold, time remaining
├── StreakAnalytics.tsx               # NEW: Detailed analytics view
├── StreakChart.tsx                   # NEW: Daily reading chart visualization
└── StreakSettings.tsx                # NEW: Threshold configuration UI

lib/
├── db/
│   └── schema/
│       └── streaks.ts                # EXISTS: Enhanced with threshold field
├── repositories/
│   └── streak.repository.ts          # EXISTS: Enhanced with threshold methods
├── services/
│   └── streak.service.ts             # NEW: Business logic for threshold management
└── streaks.ts                        # EXISTS: Enhanced with threshold-aware logic

migrations/
└── XXXX_add_streak_threshold.sql     # NEW: Add dailyThreshold column

tests/
├── unit/
│   └── streak.service.test.ts        # NEW: Threshold validation tests
└── integration/
    └── streak.repository.test.ts     # NEW: Database integration tests
```

**Structure Decision**: Web application structure selected. Feature builds on existing Next.js app structure with established patterns (app directory, API routes, component library). New streak analytics page added under `app/streak/`, following existing pattern of feature-specific directories.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations - this section not applicable.
