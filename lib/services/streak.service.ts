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

    // Recalculate streak with new threshold
    // This handles the case where user has already logged progress today
    // that now meets (or no longer meets) the new threshold
    const { updateStreaks } = await import("@/lib/streaks");
    await updateStreaks(userId);

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
