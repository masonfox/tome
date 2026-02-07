import { streakRepository } from "@/lib/repositories/streak.repository";
import { progressRepository } from "@/lib/repositories/progress.repository";
import { Streak } from "@/lib/db/schema/streaks";
import { getLogger } from "@/lib/logger";
import { differenceInHours, endOfDay, differenceInDays, startOfDay, isEqual, format, parseISO } from "date-fns";
import { toZonedTime, fromZonedTime, formatInTimeZone } from "date-fns-tz";
import { toDateString } from "@/utils/dateHelpers.server";

const logger = getLogger();

export interface StreakWithHoursRemaining extends Streak {
  hoursRemainingToday: number;
}

/**
 * StreakService - Handles streak tracking and daily goal management
 * 
 * Provides methods for:
 * - Checking and resetting streaks based on daily activity
 * - Rebuilding streaks from historical progress data
 * - Managing daily reading thresholds
 * - Generating streak analytics and activity calendars
 * 
 * All calculations are timezone-aware using the user's configured timezone.
 * 
 * This is the single source of truth for streak business logic in the application.
 * All streak-related operations should go through this service for consistency.
 */
export class StreakService {
  /**
   * Check and reset streak if more than 1 day has passed since last activity
   * This is an explicit write operation that should be called before reading streak data
   * 
   * Features:
   * - Idempotent: Only runs once per day (uses lastCheckedDate)
   * - Timezone-aware: Uses user's configured timezone for day boundaries
   * - Efficient: Skips unnecessary checks when already verified today
   *
   * @returns {Promise<boolean>} True if streak was reset, false otherwise
   */
  async checkAndResetStreakIfNeeded(userId: number | null = null): Promise<boolean> {
    const streak = await streakRepository.getOrCreate(userId);

    // Get today in user's timezone as YYYY-MM-DD string
    const now = new Date();
    const todayInUserTz = startOfDay(toZonedTime(now, streak.userTimezone));
    const todayString = toDateString(todayInUserTz);

    // Idempotency check: Have we already checked today?
    if (streak.lastCheckedDate) {
      if (streak.lastCheckedDate === todayString) {
        logger.debug(
          { lastChecked: streak.lastCheckedDate },
          "[Streak] Already checked today, skipping"
        );
        return false; // Already checked today, no need to check again
      }
    }

    // Update last checked date
    await streakRepository.update(streak.id, {
      lastCheckedDate: todayString,
    } as any);

    // Check if streak should be reset due to missed days
    // Parse YYYY-MM-DD string as local midnight
    const lastActivityParts = streak.lastActivityDate.split('-').map(Number);
    const lastActivity = new Date(lastActivityParts[0], lastActivityParts[1] - 1, lastActivityParts[2]);
    const daysSinceLastActivity = differenceInDays(todayInUserTz, lastActivity);

    // If last activity was more than 1 day ago, streak is broken
    if (daysSinceLastActivity > 1 && streak.currentStreak > 0) {
      logger.info(
        {
          daysSinceLastActivity,
          lastActivity: lastActivity.toISOString(),
          currentStreak: streak.currentStreak,
          timezone: streak.userTimezone,
        },
        "[Streak] Streak broken due to missed days, resetting to 0"
      );

      // Reset the current streak to 0
      await streakRepository.update(streak.id, {
        currentStreak: 0,
      } as any);

      return true; // Reset occurred
    }

    return false; // No reset needed
  }

  /**
   * Get streak with computed hours remaining today
   * Auto-creates streak record if it doesn't exist
   * Read-only operation - no side effects
   */
  async getStreak(userId: number | null = null): Promise<StreakWithHoursRemaining> {
    const streak = await streakRepository.getOrCreate(userId);

    // Calculate hours remaining today in user's timezone
    const now = new Date();
    const userTimezone = streak.userTimezone || 'America/New_York';
    
    // Convert to user's timezone for accurate end-of-day calculation
    const nowInUserTz = toZonedTime(now, userTimezone);
    const endOfTodayInUserTz = endOfDay(nowInUserTz);
    
    // Calculate hours remaining in user's timezone
    const hoursRemaining = Math.max(0, differenceInHours(endOfTodayInUserTz, nowInUserTz));

    return {
      ...streak,
      hoursRemainingToday: hoursRemaining,
    };
  }

  /**
   * Rebuild streak from all progress data
   * Inline implementation to avoid Bun module caching issues in tests
   * Uses user's timezone for all day boundary calculations
   */
  async rebuildStreak(userId: number | null = null, currentDate?: Date): Promise<Streak> {
    logger.info("[Streak] Rebuilding streak from all progress data");

    // Get current streak to check the dailyThreshold and timezone
    const existingStreak = await streakRepository.findByUserId(userId || null);
    const dailyThreshold = existingStreak?.dailyThreshold || 1;
    const userTimezone = existingStreak?.userTimezone || 'America/New_York';

    logger.info({ dailyThreshold, userTimezone }, "[Streak] Using threshold and timezone for rebuild");

    // Get all progress logs ordered by date
    const allProgress = await progressRepository.getAllProgressOrdered();

    if (allProgress.length === 0) {
      logger.info("[Streak] No progress data found, creating empty streak");
      return await streakRepository.getOrCreate(userId);
    }

    // Group progress by date and calculate daily activity (in user's timezone)
    const dailyActivity = new Map<string, number>();
    const qualifyingDates = new Set<string>(); // Only dates that meet the threshold

    allProgress.forEach((progress) => {
      // progressDate is stored as a UTC date string in YYYY-MM-DD format
      // Use it directly as the date key (it's already normalized to UTC calendar day)
      const dateKey = progress.progressDate;
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
    // Parse first date as UTC midnight
    const firstDateStr = sortedDates[0];
    const firstDateUtc = firstDateStr ? parseISO(`${firstDateStr}T00:00:00.000Z`) : new Date();
    let streakStartDate = firstDateUtc;
    let lastActivityDate = firstDateUtc;

    if (sortedDates.length > 0) {
      currentStreak = 1;
      longestStreak = 1;

      for (let i = 1; i < sortedDates.length; i++) {
        // Parse date strings as UTC midnight and calculate difference
        const dateInLoopStr = sortedDates[i];
        const prevDateStr = sortedDates[i - 1];
        const dateInLoop = parseISO(`${dateInLoopStr}T00:00:00.000Z`);
        const prevDate = parseISO(`${prevDateStr}T00:00:00.000Z`);
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
      // Compare calendar days in user's timezone
      const now = currentDate || new Date();
      const nowInUserTz = startOfDay(toZonedTime(now, userTimezone));
      const todayStr = toDateString(nowInUserTz);
      const lastActivityStr = toDateString(lastActivityDate);
      const today = parseISO(`${todayStr}T00:00:00.000Z`);
      const lastActivityDay = parseISO(`${lastActivityStr}T00:00:00.000Z`);
      const daysSinceLastActivity = differenceInDays(today, lastActivityDay);

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
      timezone: userTimezone,
    }, "[Streak] Calculated streak stats");

    // Update or create streak record
    const streak = await streakRepository.upsert(userId || null, {
      currentStreak,
      longestStreak,
      lastActivityDate: toDateString(lastActivityDate),
      streakStartDate: toDateString(streakStartDate),
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
   * Uses user's timezone for all day boundary calculations
   */
  async updateStreaks(userId: number | null = null): Promise<Streak> {
    logger.debug({ userId: userId || null }, "[Streak] updateStreaks called");

    // Get or create streak record
    let streak = await streakRepository.findByUserId(userId || null);

    if (!streak) {
      logger.debug("[Streak] No existing streak found, creating new one");
      const userTimezone = 'America/New_York'; // Default timezone for new users
      const now = new Date();
      const todayInUserTz = startOfDay(toZonedTime(now, userTimezone));
      const todayUtc = fromZonedTime(todayInUserTz, userTimezone);
      const todayStr = toDateString(todayUtc);
      streak = await streakRepository.create({
        userId: userId || null,
        currentStreak: 1,
        longestStreak: 1,
        lastActivityDate: todayStr,
        streakStartDate: todayStr,
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

    // Get today's progress to check if there's activity (using user's timezone)
    const userTimezone = streak.userTimezone || 'America/New_York';
    const now = new Date();
    const todayInUserTz = startOfDay(toZonedTime(now, userTimezone));
    const todayUtc = fromZonedTime(todayInUserTz, userTimezone);
    
    // Need end of day for date range query
    const tomorrowInUserTz = new Date(todayInUserTz);
    tomorrowInUserTz.setDate(tomorrowInUserTz.getDate() + 1);
    const tomorrowUtc = fromZonedTime(tomorrowInUserTz, userTimezone);
    
    const todayProgress = await progressRepository.getProgressForDate(toDateString(todayUtc), toDateString(tomorrowUtc));

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

    // Has activity today, check if it's consecutive (using user's timezone)
    // Parse YYYY-MM-DD string as local date
    const lastActivityParts = streak.lastActivityDate.split('-').map(Number);
    const lastActivity = new Date(lastActivityParts[0], lastActivityParts[1] - 1, lastActivityParts[2]);
    const daysDiff = differenceInDays(todayInUserTz, lastActivity);

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
        lastActivityDate: toDateString(todayUtc),
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
        lastActivityDate: toDateString(todayUtc),
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
      lastActivityDate: toDateString(todayUtc),
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
        streakStartDate: toDateString(todayUtc),
        totalDaysActive: newTotalDays,
        lastActivityDate: toDateString(todayUtc),
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
    await this.rebuildStreak(userId);

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

  /**
   * Get streak analytics data including daily reading history
   * @param days Number of days to fetch, or special values "this-year" or "all-time"
   * @param userId User ID (null for default user)
   * @returns Analytics data with streak info and daily reading history
   */
  async getAnalytics(
    days: number | "this-year" | "all-time" = 365,
    userId: number | null = null
  ): Promise<{
    streak: {
      currentStreak: number;
      longestStreak: number;
      dailyThreshold: number;
      totalDaysActive: number;
    };
    dailyReadingHistory: {
      date: string;
      pagesRead: number;
      thresholdMet: boolean;
    }[];
    booksAheadOrBehind?: number;
  }> {
    const now = new Date();
    let actualDays: number;

    // Handle special time period options
    if (days === "this-year") {
      // Calculate days from January 1st of current year to today
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      actualDays = Math.ceil((now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
    } else if (days === "all-time") {
      // Use a large number to fetch all available data
      actualDays = 3650; // ~10 years
    } else {
      actualDays = days;
    }

    const streak = await this.getStreak(userId);
    if (!streak) {
      throw new Error("No streak record found for user");
    }

    // Get user timezone for date calculations
    const userTimezone = streak.userTimezone || "America/New_York";

    // Calculate date range in the user's timezone to ensure correct day boundaries
    // Get current date/time in user's timezone
    const nowInUserTz = toZonedTime(new Date(), userTimezone);
    
    // Calculate start date by going back N days in user's timezone
    const requestedStartDateInUserTz = new Date(nowInUserTz);
    requestedStartDateInUserTz.setDate(requestedStartDateInUserTz.getDate() - actualDays);
    requestedStartDateInUserTz.setHours(0, 0, 0, 0);
    
    // Convert back to UTC timestamp for database queries
    const requestedStartDate = fromZonedTime(requestedStartDateInUserTz, userTimezone);
    
    // End date is end of today in user's timezone
    const endDateInUserTz = new Date(nowInUserTz);
    endDateInUserTz.setHours(23, 59, 59, 999);
    const endDate = fromZonedTime(endDateInUserTz, userTimezone);
    
    // Get the earliest progress date as a string to avoid timezone conversion issues
    const earliestProgressDateStr = await progressRepository.getEarliestProgressDateString();
    
    // Calculate the requested start date as a string in YYYY-MM-DD format
    const requestedStartDateStr = formatInTimeZone(
      requestedStartDate,
      userTimezone,
      'yyyy-MM-dd'
    );
    
    // Use the later of: requested start date OR earliest progress date
    // This prevents showing empty data before the user started tracking
    // Compare as strings to avoid timezone issues
    const actualStartDateStr = earliestProgressDateStr && earliestProgressDateStr > requestedStartDateStr
      ? earliestProgressDateStr
      : requestedStartDateStr;
    
    // Parse the actualStartDateStr back to a Date in the user's timezone
    const [year, month, day] = actualStartDateStr.split('-').map(Number);
    const actualStartDateInUserTz = new Date(year, month - 1, day);
    actualStartDateInUserTz.setHours(0, 0, 0, 0);
    const actualStartDate = fromZonedTime(actualStartDateInUserTz, userTimezone);
    
    const history = await progressRepository.getActivityCalendar(
      toDateString(actualStartDate),
      toDateString(endDate),
      userTimezone
    );

    // Create a map of existing data for quick lookup
    const dataMap = new Map<string, number>();
    history.forEach((day) => {
      dataMap.set(day.date, day.pagesRead);
    });

    // Fill in all days in the range, including days with no data (0 pages)
    // getActivityCalendar returns dates in the user's timezone, so we iterate through
    // dates in the user's timezone as well
    const allDays: { date: string; pagesRead: number; thresholdMet: boolean }[] = [];
    
    // Get the start date in the user's timezone
    const startDateInUserTz = toZonedTime(actualStartDate, userTimezone);
    startDateInUserTz.setHours(0, 0, 0, 0);
    
    // Use endDateInUserTz calculated earlier (end of today in user's timezone)
    // This ensures we only show data up to the current day in the user's timezone
    
    const currentDate = new Date(startDateInUserTz);
    while (currentDate <= endDateInUserTz) {
      // Format as a date string in the user's timezone
      const dateStr = formatInTimeZone(
        fromZonedTime(currentDate, userTimezone),
        userTimezone,
        'yyyy-MM-dd'
      );
      const pagesRead = dataMap.get(dateStr) || 0;
      
      allDays.push({
        date: dateStr,
        pagesRead,
        thresholdMet: pagesRead >= streak.dailyThreshold,
      });
      
      currentDate.setDate(currentDate.getDate() + 1);
    }

    const enrichedHistory = allDays;

    // Calculate books ahead/behind (optional, only if reading goal exists)
    // TODO: Implement when reading goal feature is available
    // For now, we'll check if a goal exists and calculate accordingly
    let booksAheadOrBehind: number | undefined = undefined;

    // Return analytics data
    return {
      streak: {
        currentStreak: streak.currentStreak,
        longestStreak: streak.longestStreak,
        dailyThreshold: streak.dailyThreshold,
        totalDaysActive: streak.totalDaysActive,
      },
      dailyReadingHistory: enrichedHistory,
      ...(booksAheadOrBehind !== undefined && { booksAheadOrBehind }),
    };
  }

  /**
   * Get activity calendar data for a specific time period
   * Returns daily page read counts for the specified year/month
   * 
   * @param userId User ID (null for default user)
   * @param year Year to fetch (defaults to current year)
   * @param month Month to fetch (0-11, undefined for entire year)
   * @returns Array of daily activity records with date and pages read
   */
  async getActivityCalendar(
    userId: number | null = null,
    year?: number,
    month?: number
  ): Promise<{ date: string; pagesRead: number }[]> {
    // Get user timezone from streak record
    const streak = await this.getStreakBasic(userId);
    const userTimezone = streak.userTimezone || 'America/New_York';

    const startDate = new Date(year || new Date().getFullYear(), month || 0, 1);
    const endDate = new Date(
      year || new Date().getFullYear(),
      (month !== undefined ? month : 11) + 1,
      0
    );

    return await progressRepository.getActivityCalendar(toDateString(startDate), toDateString(endDate), userTimezone);
  }

  /**
   * Enable or disable streak tracking
   * When enabling, optionally set an initial daily goal
   */
  async setStreakEnabled(
    userId: number | null,
    enabled: boolean,
    dailyThreshold?: number
  ): Promise<Streak> {
    // Get or create streak
    const streak = await streakRepository.getOrCreate(userId);

    logger.info(
      {
        userId,
        oldEnabled: streak.streakEnabled,
        newEnabled: enabled,
        dailyThreshold,
      },
      "Updating streak enabled status"
    );

    // Update enabled status and optionally threshold
    const updates: Partial<Streak> = {
      streakEnabled: enabled,
    };

    if (enabled && dailyThreshold !== undefined) {
      // Validate threshold when enabling
      if (!Number.isInteger(dailyThreshold)) {
        throw new Error("Daily threshold must be an integer");
      }
      if (dailyThreshold < 1 || dailyThreshold > 9999) {
        throw new Error("Daily threshold must be between 1 and 9999");
      }
      updates.dailyThreshold = dailyThreshold;
    }

    const updated = await streakRepository.update(streak.id, updates as any);

    // If enabling, rebuild streak from historical data
    if (enabled && !streak.streakEnabled) {
      logger.info({ userId }, "Streak enabled, rebuilding from historical data");
      await this.rebuildStreak(userId);

      // Fetch final state after rebuild
      const finalStreak = await streakRepository.findByUserId(userId);
      return finalStreak!;
    }

    logger.info(
      {
        userId,
        enabled: updated?.streakEnabled,
      },
      "Streak enabled status updated"
    );

    return updated!;
  }
}

// Singleton instance
export const streakService = new StreakService();
