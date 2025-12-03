import { startOfDay, differenceInDays, isEqual } from "date-fns";
import { toZonedTime, fromZonedTime, formatInTimeZone } from "date-fns-tz";
import { streakRepository, progressRepository } from "@/lib/repositories";
import type { Streak } from "@/lib/db/schema/streaks";
import { getLogger } from "@/lib/logger";
const logger = getLogger();

export async function updateStreaks(userId?: number | null): Promise<Streak> {
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

  // Get today's progress to check if there's activity (using user's timezone)
  const userTimezone = streak.userTimezone || 'America/New_York';
  const now = new Date();
  const todayInUserTz = startOfDay(toZonedTime(now, userTimezone));
  const todayUtc = fromZonedTime(todayInUserTz, userTimezone);
  
  // Need end of day for date range query
  const tomorrowInUserTz = new Date(todayInUserTz);
  tomorrowInUserTz.setDate(tomorrowInUserTz.getDate() + 1);
  const tomorrowUtc = fromZonedTime(tomorrowInUserTz, userTimezone);
  
  const todayProgress = await progressRepository.getProgressForDate(todayUtc, tomorrowUtc);

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
  const lastActivity = startOfDay(toZonedTime(streak.lastActivityDate, userTimezone));
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
        lastActivityDate: todayUtc,
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
        lastActivityDate: todayUtc,
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
      lastActivityDate: todayUtc,
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
      streakStartDate: todayUtc,
      totalDaysActive: newTotalDays,
      lastActivityDate: todayUtc,
    } as any);
    return updated!;
  }

  return streak;
}

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
export async function checkAndResetStreakIfNeeded(userId?: number | null): Promise<boolean> {
  const streak = await streakRepository.getOrCreate(userId || null);

  // Get today in user's timezone
  const now = new Date();
  const todayInUserTz = startOfDay(toZonedTime(now, streak.userTimezone));

  // Idempotency check: Have we already checked today?
  if (streak.lastCheckedDate) {
    const lastChecked = startOfDay(toZonedTime(streak.lastCheckedDate, streak.userTimezone));
    
    if (isEqual(todayInUserTz, lastChecked)) {
      logger.debug(
        { lastChecked: lastChecked.toISOString() },
        "[Streak] Already checked today, skipping"
      );
      return false; // Already checked today, no need to check again
    }
  }

  // Update last checked timestamp (convert back to UTC for storage)
  const lastCheckedUtc = fromZonedTime(todayInUserTz, streak.userTimezone);
  await streakRepository.update(streak.id, {
    lastCheckedDate: lastCheckedUtc,
  } as any);

  // Check if streak should be reset due to missed days
  const lastActivity = startOfDay(toZonedTime(streak.lastActivityDate, streak.userTimezone));
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
 * Get streak data without side effects
 * Read-only operation
 */
export async function getStreak(userId?: number | null): Promise<Streak> {
  return await streakRepository.getOrCreate(userId || null);
}

export async function getOrCreateStreak(userId?: number | null): Promise<Streak> {
  let streak = await streakRepository.findByUserId(userId || null);

  if (!streak) {
    const now = new Date();
    streak = await streakRepository.create({
      userId: userId || null,
      currentStreak: 0,
      longestStreak: 0,
      lastActivityDate: now,
      streakStartDate: now,
      totalDaysActive: 0,
    });
  }

  return streak;
}

export async function rebuildStreak(userId?: number | null, currentDate?: Date): Promise<Streak> {
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
    return await getOrCreateStreak(userId);
  }

  // Group progress by date and calculate daily activity (in user's timezone)
  const dailyActivity = new Map<string, number>();
  const qualifyingDates = new Set<string>(); // Only dates that meet the threshold

  allProgress.forEach((progress) => {
    // Convert progress date to user's timezone for day boundary calculation
    const dateInUserTz = toZonedTime(progress.progressDate, userTimezone);
    const dateKey = formatInTimeZone(startOfDay(dateInUserTz), userTimezone, 'yyyy-MM-dd');
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
  // Convert date strings back to proper timezone-aware dates
  const firstDateStr = sortedDates[0];
  const firstDateInTz = firstDateStr ? new Date(`${firstDateStr}T00:00:00`) : new Date();
  const firstDateUtc = firstDateStr ? fromZonedTime(firstDateInTz, userTimezone) : new Date();
  let streakStartDate = firstDateUtc;
  let lastActivityDate = firstDateUtc;

  if (sortedDates.length > 0) {
    currentStreak = 1;
    longestStreak = 1;

    for (let i = 1; i < sortedDates.length; i++) {
      // Convert date strings to timezone-aware dates
      const dateInLoopStr = sortedDates[i];
      const prevDateStr = sortedDates[i - 1];
      const dateInLoopInTz = new Date(`${dateInLoopStr}T00:00:00`);
      const prevDateInTz = new Date(`${prevDateStr}T00:00:00`);
      const daysDiff = differenceInDays(dateInLoopInTz, prevDateInTz);

      if (daysDiff === 1) {
        // Consecutive day
        currentStreak++;
      } else {
        // Gap in streak
        longestStreak = Math.max(longestStreak, currentStreak);
        currentStreak = 1;
        streakStartDate = fromZonedTime(dateInLoopInTz, userTimezone);
      }
      lastActivityDate = fromZonedTime(dateInLoopInTz, userTimezone);
    }

    longestStreak = Math.max(longestStreak, currentStreak);

    // Check if last activity was more than 1 day ago (streak is broken)
    // Use user's timezone for day boundary comparison
    const now = currentDate || new Date();
    const today = startOfDay(toZonedTime(now, userTimezone));
    const lastActivityDayStart = startOfDay(toZonedTime(lastActivityDate, userTimezone));
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
    timezone: userTimezone,
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

export async function getActivityCalendar(
  userId?: number | null,
  year?: number,
  month?: number
): Promise<{ date: string; pagesRead: number }[]> {
  // Get user timezone from streak record
  const streak = await streakRepository.getOrCreate(userId || null);
  const userTimezone = streak.userTimezone || 'America/New_York';

  const startDate = new Date(year || new Date().getFullYear(), month || 0, 1);
  const endDate = new Date(
    year || new Date().getFullYear(),
    (month !== undefined ? month : 11) + 1,
    0
  );

  return await progressRepository.getActivityCalendar(startDate, endDate, userTimezone);
}
