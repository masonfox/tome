import { streakRepository } from "@/lib/repositories/streak.repository";
import { Streak } from "@/lib/db/schema/streaks";
import { getLogger } from "@/lib/logger";
import { differenceInHours, endOfDay } from "date-fns";

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
   * Uses dynamic import to work around Bun module caching issues in tests
   */
  async rebuildStreak(userId: number | null = null, currentDate?: Date): Promise<Streak> {
    console.log('[StreakService.rebuildStreak] Called');
    const { rebuildStreak } = await import("@/lib/streaks");
    console.log('[StreakService.rebuildStreak] Imported, calling function');
    const result = await rebuildStreak(userId, currentDate);
    console.log('[StreakService.rebuildStreak] Result:', !!result);
    return result;
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
