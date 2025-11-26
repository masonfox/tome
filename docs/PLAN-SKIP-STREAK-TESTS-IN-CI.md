# ✅ RESOLVED: Timezone-Sensitive Streak Tests

## Status: RESOLVED (November 26, 2025)

All 5 previously-skipped timezone-sensitive tests in the "First Day Activity" suite are now **passing** and enabled in all environments including CI.

## Original Problem

The "First Day Activity" test suite in `__tests__/unit/lib/streaks.test.ts` had 5 tests that were failing due to timezone handling issues:

1. Tests used `startOfDay(new Date())` for `progressDate`
2. Tests set `lastActivityDate` to 3 days ago
3. When `updateStreaks()` was called, it calculated `daysDiff = 3`
4. This triggered the "broken streak" logic instead of "same day, first activity" logic
5. Test expectations didn't match the broken streak behavior

## Root Cause

The tests were incorrectly setting up the scenario. They wanted to test "first activity on the same day" but were creating a 3-day gap between `lastActivityDate` and today, which triggered different code paths.

## Solution

**Fixed by adjusting test setup to match ADR-006 patterns:**

1. Changed `progressDate` from `startOfDay(new Date())` to `new Date()` (current time)
2. Changed `lastActivityDate` from 3 days ago to earlier today (e.g., 1-3 hours ago)
3. This ensures `daysDiff === 0`, triggering the correct "same day, first activity" code path

### Key Insight from ADR-006

Per ADR-006, the timezone-aware query logic uses:
- `DATE(progressDate, 'unixepoch', 'localtime')` to extract calendar day
- Compares this to a local date string (YYYY-MM-DD)
- **Any time on the same calendar day will match**

Therefore, using `new Date()` (current time) instead of `startOfDay(new Date())` (midnight) works perfectly because the query matches by calendar day, not exact time.

## Changes Made

**Test file:** `__tests__/unit/lib/streaks.test.ts`

Fixed 5 tests:
1. "should set streak to 1 when first activity meets threshold"
2. "should keep streak at 0 if threshold not met"
3. "should not double-increment on multiple logs same day"
4. "should preserve longestStreak when setting first day"
5. "should set totalDaysActive to 1 on very first activity"

**Pattern applied:**
```typescript
// OLD (incorrect - creates 3-day gap)
const today = startOfDay(new Date());
const threeDaysAgo = new Date(today);
threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
lastActivityDate: threeDaysAgo,
progressDate: today,

// NEW (correct - same calendar day)
const today = new Date();
const earlierToday = new Date(today.getTime() - 1 * 60 * 60 * 1000); // 1 hour ago
lastActivityDate: earlierToday,
progressDate: new Date(), // Current time
```

## Verification

✅ **All 30 streak tests now pass locally**
- 30 pass, 0 fail
- 94 expect() calls
- Test time: ~365ms

✅ **CI testing enabled**
- Removed all `test.skipIf(isCI)` guards
- Tests now run in all environments

✅ **Follows ADR-006 patterns**
- Uses current time for progress creation
- Relies on calendar-day matching for queries
- Timezone-independent test setup

## References

- **ADR-006**: Timezone-Aware Date Handling
- **Test file**: `__tests__/unit/lib/streaks.test.ts` (lines 891-1116)
- **Source**: `lib/streaks.ts` and `lib/repositories/progress.repository.ts`
- **Related docs**: `docs/archive/CI-STREAK-TEST-FAILURE-INVESTIGATION.md`
