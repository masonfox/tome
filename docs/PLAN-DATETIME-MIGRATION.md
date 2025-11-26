# Datetime Storage Migration Plan (Epoch → ISO 8601 TEXT)

## Context
The app currently stores timestamps as Unix epoch integers in SQLite (via drizzle `integer(..., { mode: "timestamp" })`), with defaults like `unixepoch()`. Application code converts between JS `Date` and DB values in many places, and queries often use SQLite date functions with `'unixepoch'` and sometimes `'localtime'`. This creates inconsistency, fragility, and potential timezone bugs.

Key places using timestamps:
- Tables: `progress_logs`, `reading_sessions`, `streaks`
- Services/Repos: `lib/streaks.ts`, `lib/repositories/*`, `lib/services/*`, `lib/dashboard-service.ts`
- Tests and charts rely on JS `Date` and `date-fns`.

## Evaluation

### Pros of Epoch Int
- Compact integer storage; fast comparisons and indexing
- Stable across timezones if handled explicitly
- SQLite supports `'unixepoch'` conversion in functions

### Cons / Risks
- Conversions scattered across layers (SQL and JS)
- Readability suffers (opaque ints; seconds vs milliseconds confusion)
- Timezone nuances (UTC vs local) can produce grouping/off‑by‑one issues
- Harder to debug data in DB

### Options
1) Keep epoch, but centralize conversions and conventions
- Define single helper API for read/write; enforce UTC logic in one place
- Minimal migration; still opaque and requires discipline

2) Migrate to ISO 8601 UTC TEXT
- Store canonical ISO strings (`toISOString()`)
- Human‑readable; lexicographic order works; easy JS interop
- Moderate migration; adjust queries from `'unixepoch'` to TEXT functions

3) ISO TEXT + helper views for epoch math
- Store ISO TEXT; create views using `strftime('%s', column)` for math
- Readable at rest, efficient math via views
- More schema complexity; extra dev knowledge required

## Recommendation
- Short term: Option 1 (centralize epoch handling) to stabilize behavior.
- Medium term: Option 2 (ISO 8601 UTC TEXT) as the target. It reduces fragility, improves clarity, and aligns with JS/TS+date‑fns usage.

## Principles
- Store everything in UTC as ISO 8601 TEXT (e.g., `2025-11-26T12:34:56.789Z`).
- Do timezone conversion only for display in UI.
- Do day/month grouping either:
  - In SQL consistently in UTC, or
  - In application layer using JS `Date` if locale‑aware grouping is desired.

## Phased Plan

### Phase 0: Stabilize (immediately)
- Add `lib/utils/datetime.ts`:
  - `toDbIsoUTC(date: Date): string` → `date.toISOString()`
  - `fromDbIsoUTC(text: string): Date` → `new Date(text)`
  - `nowIsoUTC(): string` → `new Date().toISOString()`
  - (During transition) `epochSecToDate(sec: number): Date` and `dateToEpochSec(date: Date): number`
- Refactor repositories/services to use these helpers consistently for all conversions.
- Audit queries to remove mixing of `'localtime'`; use UTC consistently.

### Phase 1: Schema Migration (drizzle + SQL)
- Convert timestamp columns from `integer({ mode: 'timestamp' })` to `text(...)`:
  - `progress_logs.progressDate`, `progress_logs.createdAt`
  - `reading_sessions.startedDate`, `completedDate`, `createdAt`, `updatedAt`
  - `streaks.lastActivityDate`, `streakStartDate`, `updatedAt`
- Defaults:
  - Prefer app‑level explicit writes (`nowIsoUTC()`) rather than DB defaults.
  - If defaults are needed: use `strftime('%Y-%m-%dT%H:%M:%fZ', 'now')` for proper ISO UTC.
- Data conversion migration (SQLite SQL):
  - Example: `UPDATE progress_logs SET progress_date = strftime('%Y-%m-%dT%H:%M:%fZ', progress_date, 'unixepoch');`
  - Repeat for all affected columns.

### Phase 2: Repository & Query Refactor
- Replace `DATE(column, 'unixepoch')` with TEXT‑based functions:
  - For ISO TEXT, grouping by day: `DATE(column)` (treats ISO UTC appropriately)
  - For math (ordering, ranges), either rely on ISO lexicographic order or use `strftime('%s', column)` to get epoch seconds on the fly
- Ensure ordering: ISO TEXT orders correctly; otherwise use `strftime('%s', column)` in ORDER BY.
- Centralize day bucketing logic to avoid drift.

### Phase 3: Services & UI
- Read/write all timestamps via `lib/utils/datetime` helpers.
- Chart formatting: continue using `date-fns` on JS `Date` produced from ISO.
- Keep all analytics in UTC unless explicitly specified otherwise.

### Phase 4: Tests
- Update fixtures to ISO TEXT where DB‑shape is required.
- Ensure service tests construct `Date` and rely on helpers to map to DB.
- Validate edge cases (month boundaries, DST irrelevant under UTC, etc.).

### Phase 5: Rollout & Backwards Compatibility
- Single migration step converts all data.
- If needed, keep temporary tolerance (read both int and text) for one release, then remove.

## Effort Estimate
- Utilities + repository refactors: 1–2 days
- Migrations + conversions: 0.5–1 day
- Tests adjustments: 0.5–1 day
- Total: ~3–4 days including review and verification

## Risks & Mitigations
- Day grouping changes: enforce UTC everywhere; test analytics outputs before/after
- Performance: ISO TEXT comparisons slightly slower than ints; mitigate with indexes and occasional `strftime('%s', column)`
- Developer confusion: document the standard in `docs/` and enforce via code review and helper usage

## Decision
Proceed with Phase 0 immediately. Plan and execute Phases 1–5 to migrate to ISO 8601 UTC TEXT over the next iteration. This yields clearer data, fewer conversion bugs, and a simpler mental model across the stack.
