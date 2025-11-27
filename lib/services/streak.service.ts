import { streakRepository } from "@/lib/repositories/streak.repository";
import { progressRepository } from "@/lib/repositories/progress.repository";
import { Streak } from "@/lib/db/schema/streaks";
import { getLogger } from "@/lib/logger";
import { differenceInHours, endOfDay, differenceInDays, startOfDay } from "date-fns";

const logger = getLogger();

export interface StreakWithHoursRemaining extends Streak {
  hoursRemainingToday: number;
}

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
