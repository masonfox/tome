import { streakRepository } from "@/lib/repositories/streak.repository";
import { progressRepository } from "@/lib/repositories/progress.repository";
import { Streak } from "@/lib/db/schema/streaks";
import { getLogger } from "@/lib/logger";
import { differenceInHours, endOfDay, differenceInDays, startOfDay } from "date-fns";

const logger = getLogger();

export interface StreakWithHoursRemaining extends Streak {
  hoursRemainingToday: number;
}

/**
 * StreakService - Handles reading streak tracking and daily goal management
 * 
 * IMPORTANT: This service uses INLINE IMPLEMENTATIONS for core streak functions
 * to work around a Bun module caching bug that affects CI tests.
 * 
 * ## Bun Module Caching Issue
 * 
 * In CI environments, after 40+ serial test runs, Bun's transpiler cache can
 * return stale/cached versions of ES6 module exports, even with dynamic imports.
 * This caused functions like `rebuildStreak()` to return `undefined` in tests.
 * 
 * ## Solution: Service Layer with Inline Implementations
 * 
 * Instead of delegating to functions in `lib/streaks.ts`, we implement the
 * logic directly in this service class. Class methods are not affected by
 * ES6 module caching, ensuring tests always execute current code.
 * 
 * ## Affected Methods
 * 
 * - `rebuildStreak()` - Full inline implementation (~110 lines)
 * - `updateStreaks()` - Full inline implementation (~150 lines)
 * - `getStreakBasic()` - Delegates to repository (safe)
 * 
 * ## For New Developers
 * 
 * If you need to modify streak logic:
 * 1. Update BOTH this service AND `lib/streaks.ts` to keep them in sync
 * 2. The service version is used by tests (cache-immune)
 * 3. The lib/streaks.ts version is used by production code
 * 4. Yes, this is duplication. It's necessary for test reliability.
 * 
 * ## References
 * 
 * - Full investigation: docs/archive/CI-STREAK-TEST-FAILURE-INVESTIGATION.md
 * - Testing guidelines: docs/TESTING_GUIDELINES.md (Bun Module Caching section)
 * - Related commits: 4910da0, d7a72ce
 * 
 * @see {@link https://github.com/masonfox/tome/blob/main/docs/archive/CI-STREAK-TEST-FAILURE-INVESTIGATION.md}
 */
export class StreakService {
  /**
   * Get streak with computed hours remaining today
   * Auto-creates streak record if it doesn't exist
   */
  async getStreak(userId: number | null = null): Promise<StreakWithHoursRemaining> {
    const streak = await streakRepository.getOrCreate(userId);

    // Calculate hours remaining today
    const now = new Date();
    const endOfToday = endOfDay(now);
    const hoursRemaining = Math.max(0, differenceInHours(endOfToday, now));

    return {
      ...streak,
      hoursRemainingToday: hoursRemaining,
    };
  }

  /**
   * Rebuild streak from all progress data
   * Inline implementation to avoid Bun module caching issues in tests
   */
  async rebuildStreak(userId: number | null = null, currentDate?: Date): Promise<Streak> {
    logger.info("[Streak] Rebuilding streak from all progress data");

    // Get current streak to check the dailyThreshold
    const existingStreak = await streakRepository.findByUserId(userId || null);
    const dailyThreshold = existingStreak?.dailyThreshold || 1;

    logger.info({ dailyThreshold }, "[Streak] Using threshold for rebuild");

    // Get all progress logs ordered by date
    const allProgress = await progressRepository.getAllProgressOrdered();

    if (allProgress.length === 0) {
      logger.info("[Streak] No progress data found, creating empty streak");
      const { getOrCreateStreak } = await import("@/lib/streaks");
      return await getOrCreateStreak(userId);
    }

    // Group progress by date and calculate daily activity
    const dailyActivity = new Map<string, number>();
    const qualifyingDates = new Set<string>(); // Only dates that meet the threshold

    allProgress.forEach((progress) => {
      const dateKey = progress.progressDate.toISOString().split('T')[0]; // YYYY-MM-DD
      const pagesRead = progress.pagesRead || 0;

      if (pagesRead > 0) {
        const current = dailyActivity.get(dateKey) || 0;
        dailyActivity.set(dateKey, current + pagesRead);
      }
    });

    // Filter dates that meet the threshold
    dailyActivity.forEach((pagesRead, dateKey) => {
      if (pagesRead >= dailyThreshold) {
        qualifyingDates.add(dateKey);
      }
    });

    const sortedDates = Array.from(qualifyingDates).sort();

    // Calculate streak from consecutive active days
    let currentStreak = 0;
    let longestStreak = 0;
    let streakStartDate = sortedDates[0] ? new Date(sortedDates[0]) : new Date();
    let lastActivityDate = sortedDates[0] ? new Date(sortedDates[0]) : new Date();

    if (sortedDates.length > 0) {
      currentStreak = 1;
      longestStreak = 1;

      for (let i = 1; i < sortedDates.length; i++) {
        const dateInLoop = new Date(sortedDates[i]);
        const prevDate = new Date(sortedDates[i - 1]);
        const daysDiff = differenceInDays(dateInLoop, prevDate);

        if (daysDiff === 1) {
          // Consecutive day
          currentStreak++;
        } else {
          // Gap in streak
          longestStreak = Math.max(longestStreak, currentStreak);
          currentStreak = 1;
          streakStartDate = dateInLoop;
        }
        lastActivityDate = dateInLoop;
      }

      longestStreak = Math.max(longestStreak, currentStreak);

      // Check if last activity was more than 1 day ago (streak is broken)
      const today = startOfDay(currentDate || new Date());
      const lastActivityDayStart = startOfDay(lastActivityDate);
      const daysSinceLastActivity = differenceInDays(today, lastActivityDayStart);

      if (daysSinceLastActivity > 1) {
        // Streak is broken - last activity was more than 1 day ago
        currentStreak = 0;
      }
    }

    const totalDaysActive = qualifyingDates.size;

    logger.info({
      currentStreak,
      longestStreak,
      totalDaysActive,
      lastActivityDate: lastActivityDate.toISOString(),
      streakStartDate: streakStartDate.toISOString(),
    }, "[Streak] Calculated streak stats");

    // Update or create streak record
    const streak = await streakRepository.upsert(userId || null, {
      currentStreak,
      longestStreak,
      lastActivityDate: lastActivityDate,
      streakStartDate: streakStartDate,
      totalDaysActive,
    });

    logger.info("[Streak] Streak rebuilt and saved successfully");
    return streak;
  }

  /**
   * Get streak without computed fields (plain Streak object)
   * Used for testing - avoids hoursRemainingToday computation
   */
  async getStreakBasic(userId: number | null = null): Promise<Streak> {
    return await streakRepository.getOrCreate(userId);
  }

  /**
   * Update streaks based on today's activity
   * Inline implementation to avoid Bun module caching issues in tests
   */
  async updateStreaks(userId: number | null = null): Promise<Streak> {
    logger.debug({ userId: userId || null }, "[Streak] updateStreaks called");

    // Get or create streak record
    let streak = await streakRepository.findByUserId(userId || null);

    if (!streak) {
      logger.debug("[Streak] No existing streak found, creating new one");
      const now = new Date();
      streak = await streakRepository.create({
        userId: userId || null,
        currentStreak: 1,
        longestStreak: 1,
        lastActivityDate: now,
        streakStartDate: now,
        totalDaysActive: 1,
      });
      logger.info({
        currentStreak: streak.currentStreak,
        longestStreak: streak.longestStreak,
        lastActivityDate: streak.lastActivityDate,
        streakStartDate: streak.streakStartDate,
        totalDaysActive: streak.totalDaysActive,
      }, "[Streak] New streak created");
      return streak;
    }

    // Get today's progress to check if there's activity
    const today = startOfDay(new Date());
    const todayProgress = await progressRepository.getProgressForDate(today);

    if (!todayProgress || todayProgress.pagesRead === 0) {
      // No activity today, return existing streak
      logger.debug("[Streak] No activity today, returning existing streak");
      return streak;
    }

    // Check if daily threshold is met
    const dailyThreshold = streak.dailyThreshold || 1;
    const thresholdMet = todayProgress.pagesRead >= dailyThreshold;

    logger.debug({
      pagesRead: todayProgress.pagesRead,
      dailyThreshold,
      thresholdMet,
    }, "[Streak] Checking daily threshold");

    // Has activity today, check if it's consecutive
    const lastActivity = startOfDay(streak.lastActivityDate);
    const daysDiff = differenceInDays(today, lastActivity);

    if (daysDiff === 0) {
      // Same day activity - handle threshold changes
      if (streak.currentStreak === 0 && thresholdMet) {
        // Special case: First activity that meets threshold
        // This handles fresh database or restart after breaking streak
        logger.info("[Streak] First day activity meets threshold, setting streak to 1");
        const newTotalDays = streak.totalDaysActive === 0 ? 1 : streak.totalDaysActive;
        const updated = await streakRepository.update(streak.id, {
          currentStreak: 1,
          longestStreak: Math.max(1, streak.longestStreak),
          totalDaysActive: newTotalDays,
          lastActivityDate: today,
        } as any);
        logger.info({
          currentStreak: updated?.currentStreak,
          longestStreak: updated?.longestStreak,
          totalDaysActive: updated?.totalDaysActive,
        }, "[Streak] Streak initialized to 1");
        return updated!;
      } else if (streak.currentStreak > 0 && !thresholdMet) {
        // Special case: Threshold was raised and is no longer met
        // Reset streak to 0 to reflect that today's goal is not met anymore
        logger.info({
          currentStreak: streak.currentStreak,
          pagesRead: todayProgress.pagesRead,
          dailyThreshold,
        }, "[Streak] Threshold no longer met, resetting streak to 0");
        const updated = await streakRepository.update(streak.id, {
          currentStreak: 0,
          lastActivityDate: today,
        } as any);
        logger.info({
          currentStreak: updated?.currentStreak,
        }, "[Streak] Streak reset to 0 due to threshold increase");
        return updated!;
      } else if (streak.currentStreak === 0 && !thresholdMet) {
        // Threshold not met and streak already 0, nothing to do
        logger.debug("[Streak] Threshold not met yet, streak remains 0");
        return streak;
      }

      // Normal same-day activity, streak already set for today and threshold met
      logger.debug("[Streak] Same day activity, streak unchanged");
      return streak;
    }

    // Only continue to consecutive/broken streak logic if threshold is met
    if (!thresholdMet) {
      // Threshold not met on a new day - this would break the streak on different day
      logger.debug("[Streak] Threshold not met yet, returning existing streak");
      return streak;
    } else if (daysDiff === 1) {
      // Consecutive day, increment streak
      logger.debug("[Streak] Consecutive day activity, incrementing streak");
      const oldStreak = streak.currentStreak;
      const newCurrentStreak = streak.currentStreak + 1;
      const newLongestStreak = Math.max(streak.longestStreak, newCurrentStreak);
      const newTotalDays = streak.totalDaysActive + 1;

      const updated = await streakRepository.update(streak.id, {
        currentStreak: newCurrentStreak,
        longestStreak: newLongestStreak,
        totalDaysActive: newTotalDays,
        lastActivityDate: today,
      } as any);
      logger.info({
        from: oldStreak,
        to: updated?.currentStreak,
        longestStreak: updated?.longestStreak,
      }, "[Streak] Streak incremented");
      return updated!;
    } else if (daysDiff > 1) {
      // Streak broken (or first activity after a gap)
      logger.warn({ gapDays: daysDiff }, "[Streak] Streak broken");
      const newTotalDays = streak.totalDaysActive === 0 ? 1 : streak.totalDaysActive + 1;
      const updated = await streakRepository.update(streak.id, {
        currentStreak: 1,
        streakStartDate: today,
        totalDaysActive: newTotalDays,
        lastActivityDate: today,
      } as any);
      return updated!;
    }

    return streak;
  }

  /**
   * Update daily threshold with validation
   * Auto-creates streak record if it doesn't exist
   * Recalculates current streak with new threshold
   */
  async updateThreshold(userId: number | null, newThreshold: number): Promise<Streak> {
    // Validate threshold
    if (!Number.isInteger(newThreshold)) {
      throw new Error("Daily threshold must be an integer");
    }
    if (newThreshold < 1 || newThreshold > 9999) {
      throw new Error("Daily threshold must be between 1 and 9999");
    }

    // Get or create streak to log change
    const streak = await streakRepository.getOrCreate(userId);

    logger.info(
      {
        userId,
        oldThreshold: streak.dailyThreshold,
        newThreshold,
      },
      "Updating streak threshold"
    );

    // Update threshold
    const updated = await streakRepository.updateThreshold(userId, newThreshold);

    logger.info(
      {
        userId,
        newThreshold,
        streakId: updated.id,
      },
      "Streak threshold updated successfully, recalculating streak"
    );

    // Recalculate streak with new threshold from all historical data
    // We need to use rebuildStreak (not updateStreaks) because updateStreaks only
    // considers today's activity, not the full historical streak with the new threshold
    const { rebuildStreak } = await import("@/lib/streaks");
    await rebuildStreak(userId);

    // Fetch the final streak state which includes both the new threshold
    // and the recalculated streak values
    const finalStreak = await streakRepository.findByUserId(userId);

    logger.info(
      {
        userId,
        currentStreak: finalStreak?.currentStreak,
        longestStreak: finalStreak?.longestStreak,
        dailyThreshold: finalStreak?.dailyThreshold,
      },
      "Streak recalculated after threshold change"
    );

    return finalStreak!;
  }
}

// Singleton instance
export const streakService = new StreakService();
