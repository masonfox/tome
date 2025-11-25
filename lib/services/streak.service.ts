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
   */
  async getStreak(userId: number | null = null): Promise<StreakWithHoursRemaining | null> {
    const streak = await streakRepository.findByUserId(userId);

    if (!streak) {
      logger.warn({ userId }, "No streak found for user");
      return null;
    }

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
   */
  async updateThreshold(userId: number | null, newThreshold: number): Promise<Streak> {
    // Validate threshold
    if (!Number.isInteger(newThreshold)) {
      throw new Error("Daily threshold must be an integer");
    }
    if (newThreshold < 1 || newThreshold > 9999) {
      throw new Error("Daily threshold must be between 1 and 9999");
    }

    // Get existing streak to log change
    const streak = await streakRepository.findByUserId(userId);
    if (!streak) {
      throw new Error("No streak record found for user");
    }

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
      "Streak threshold updated successfully"
    );

    return updated;
  }
}

// Singleton instance
export const streakService = new StreakService();
