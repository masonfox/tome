# Research: Reading Streak Tracking Enhancement

**Date**: 2025-11-25
**Feature**: Reading Streak Tracking Enhancement

## Overview

This document captures research findings and technical decisions for enhancing the reading streak tracking system in Tome.

## Technical Decisions

### 1. Daily Threshold Storage and Validation

**Decision**: Store `dailyThreshold` as INTEGER in the streaks table with CHECK constraint `dailyThreshold >= 1 AND dailyThreshold <= 9999`

**Rationale**:
- SQLite CHECK constraints provide database-level validation for data integrity
- Integer storage is efficient and matches existing schema patterns
- Range of 1-9999 pages covers reasonable use cases (1 page minimum for casual readers, 9999 maximum for speed readers)
- Validation at database level ensures consistency even if accessed outside application layer

**Alternatives considered**:
- Storing threshold as TEXT: Rejected due to unnecessary parsing overhead and weaker type safety
- No upper limit: Rejected to prevent accidental misconfigurations (e.g., typo entering 10000 instead of 100)
- Separate thresholds table: Rejected as overly complex for single-value setting per user

### 2. Timezone Handling Strategy

**Decision**: Use device's current timezone for all streak calculations, with timestamp stored in UTC and timezone applied at calculation time

**Rationale**:
- Aligns with user's perception of "today" regardless of location
- Supports travelers who move across timezones without unfair streak penalties
- JavaScript `Date` object provides reliable local timezone detection
- UTC storage ensures consistent data representation in database

**Alternatives considered**:
- Fixed timezone per user: Rejected as it doesn't support travelers and requires additional configuration
- UTC-only calculations: Rejected as "today" wouldn't match user's local day
- Storing timezone with each progress log: Rejected as unnecessarily complex; device timezone at read time is sufficient

### 3. Streak Calculation Timing

**Decision**: Calculate streak immediately after each progress log is saved, using the progress log's timestamp to determine calendar day

**Rationale**:
- Real-time feedback provides immediate motivation
- Matches existing pattern in codebase (`updateStreaks()` called after progress updates)
- Ensures streak display is always current without background jobs
- Each progress log has definitive timestamp for day assignment

**Alternatives considered**:
- Daily batch processing: Rejected as it delays user feedback and requires scheduler infrastructure
- Calculation on display: Rejected as it adds latency to every page load
- Hybrid (immediate + nightly reconciliation): Rejected as overly complex for single-user deployment

### 4. Mid-Day Threshold Changes

**Decision**: New threshold applies immediately to current day; user's progress is evaluated against new threshold at midnight

**Rationale**:
- Simplest implementation without retroactive data changes
- Gives users control over their challenge level in real-time
- Avoids complex timezone-aware retroactive recalculations
- Matches user expectation from clarifications (Question 3)

**Alternatives considered**:
- Apply starting tomorrow: Rejected as less responsive to user intent
- Conditional application (only if no reading today): Rejected as more complex without clear UX benefit

### 5. Chart Visualization Library

**Decision**: Use Recharts 2.12.0 (already in dependencies) for daily reading chart visualization

**Rationale**:
- Already included in project dependencies (zero new dependencies)
- React-friendly declarative API matches Next.js patterns
- Supports bar and line charts for daily pages display
- Good performance for 365 days of data points
- Responsive and customizable for theming

**Alternatives considered**:
- Chart.js: Rejected as requires additional dependency and imperative API less aligned with React
- D3.js: Rejected as overkill for simple time-series visualization and steeper learning curve
- Custom SVG: Rejected as reinventing wheel for standard chart needs

### 6. Analytics Data Aggregation

**Decision**: Aggregate progress logs by calendar day in SQL query, returning daily totals for chart rendering

**Rationale**:
- Database aggregation more efficient than application-level grouping
- SQLite's date functions handle timezone conversion: `date(timestamp, 'localtime')`
- Reduces data transfer between database and application
- Matches existing pattern in `getActivityCalendar()` function

**Alternatives considered**:
- Application-level aggregation: Rejected as inefficient for 365 days of granular data
- Pre-computed daily rollups table: Rejected as adds complexity and storage for data easily calculated on-demand
- Client-side aggregation: Rejected as increases network payload and client processing

### 7. Time Remaining Display

**Decision**: Calculate "time remaining today" on server-side using `differenceInHours()` from date-fns, updated on each page load

**Rationale**:
- Server-side calculation ensures accuracy across timezone changes
- date-fns already in dependencies provides reliable date arithmetic
- Simple subtraction: `endOfDay(now) - now = hours remaining`
- Fresh calculation on each page load prevents stale data

**Alternatives considered**:
- Client-side countdown: Rejected as complicates hydration and requires useEffect management
- WebSocket/SSE updates: Rejected as overly complex for rarely-changing value
- Static "by midnight" message: Rejected as less motivating than specific time remaining

### 8. Books Ahead/Behind Calculation

**Decision**: Calculate ahead/behind metric using yearly goal divided by days elapsed, compared against completed book count

**Rationale**:
- Simple linear projection: `(dayOfYear / 365) * annualGoal = expectedBooks`
- Difference between actual and expected gives ahead/behind count
- Uses existing book completion data from sessions table
- Gracefully omits metric if no reading goal set (as per clarification)

**Alternatives considered**:
- Weekly goal tracking: Rejected as less common than annual goals in reading communities
- Page-based projection: Rejected as book lengths vary wildly, making pages-ahead meaningless
- Separate goals table: Rejected as premature; can add if future features need it

### 9. Streak Celebration Messaging

**Decision**: Display celebration message when current streak equals or exceeds longest streak, stored as component logic (not database)

**Rationale**:
- Simple conditional rendering based on `currentStreak >= longestStreak`
- No state management needed - derives from existing streak data
- Messages enhance motivation without requiring storage
- Can be easily customized or A/B tested in component

**Alternatives considered**:
- Database-stored achievements: Rejected as overly complex for simple motivational messaging
- Toast notifications: Rejected as potentially intrusive on every login
- Separate achievements system: Rejected as out of scope for MVP

### 10. Default Threshold Value

**Decision**: Set default `dailyThreshold` to 1 page on streak record creation

**Rationale**:
- Lowest possible barrier to entry encourages adoption
- Users can easily increase challenge once habit formed
- Matches "smart defaults" principle from constitution
- Prevents user frustration from unattainable defaults

**Alternatives considered**:
- Higher default (e.g., 10 pages): Rejected as discouraging for casual readers
- No default (force user to set): Rejected as adds friction to onboarding
- Adaptive default based on history: Rejected as premature optimization; requires historical data

## Open Questions

None. All clarifications resolved during `/speckit.clarify` phase.

## Best Practices Applied

### Next.js & React Patterns
- Server Components for data fetching (streak analytics page)
- Client Components only where interactivity needed (settings form)
- App Router for file-based routing (`app/streak/page.tsx`)
- API routes for mutations (`app/api/streak/route.ts`)

### TypeScript & Type Safety
- Strict type checking enabled in tsconfig.json
- Infer types from Drizzle schema (`typeof streaks.$inferSelect`)
- Explicit return types on service functions
- No `any` types except where Drizzle ORM requires

### Database & Drizzle ORM
- Migrations for schema changes (never direct SQL alterations)
- Repository pattern for all database access
- Proper transaction handling for multi-step operations
- Index on userId for streak lookups (already exists via uniqueIndex)

### Testing Strategy
- Unit tests for business logic (threshold validation, streak calculation)
- Integration tests for repository methods (with real SQLite database)
- Component tests for UI interactions (settings form, analytics display)
- Test database isolation using `setDatabase()` pattern from existing tests

### Logging & Observability
- Structured logging with Pino for all streak operations
- Include correlation data (userId, streakId) in log context
- Log level: DEBUG for calculation steps, INFO for state changes, WARN for streak breaks
- Follow existing logger patterns from `lib/streaks.ts`

## Dependencies

All required dependencies already present in package.json:

- **next**: ^14.2.0 (App Router, Server Components, API routes)
- **react**: ^18.3.0 (UI components)
- **drizzle-orm**: ^0.44.7 (Database ORM, migrations)
- **better-sqlite3**: ^12.4.1 (SQLite driver)
- **date-fns**: ^3.3.0 (Date calculations, timezone handling)
- **recharts**: ^2.12.0 (Chart visualization)
- **pino**: ^9.3.1 (Structured logging)

No new dependencies required.

## Implementation Notes

### Migration Strategy

1. Create migration file: `migrations/XXXX_add_streak_threshold.sql`
2. Add `dailyThreshold` column with default value 1
3. Backfill existing streak records with default threshold
4. Run migration via existing `bun run db:migrate` script

### Data Integrity

- Existing streak data preserved during migration
- No breaking changes to existing streak schema columns
- Backward compatible: code handles missing threshold by defaulting to 1
- Migration tested with database backup/restore scripts

### Performance Considerations

- Streak calculation remains O(1) for real-time updates
- Analytics query scoped to 365 days maximum (prevents unbounded growth)
- Recharts handles 365 data points efficiently (tested at scale)
- No N+1 queries (single aggregation query for chart data)

## Security & Privacy

- No sensitive data in streak records (just counts and dates)
- Local-only storage (no external transmission)
- No authentication changes needed (inherits existing auth)
- Timezone information never persisted (privacy by design)

## Rollout Plan

1. **Phase 1**: Add threshold column and basic CRUD operations (low risk)
2. **Phase 2**: Enhance homepage streak display with threshold info (low risk)
3. **Phase 3**: Add detailed analytics page (isolated, can be disabled)
4. **Phase 4**: Integrate threshold into streak calculation logic (requires testing)

Feature can be rolled out incrementally with each phase providing value independently.
