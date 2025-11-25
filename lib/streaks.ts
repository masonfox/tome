import { startOfDay, differenceInDays } from "date-fns";
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

  if (!thresholdMet) {
    // Threshold not met yet, don't update streak
    logger.debug("[Streak] Threshold not met yet, returning existing streak");
    return streak;
  }

  // Has activity today, check if it's consecutive
  const lastActivity = startOfDay(streak.lastActivityDate);
  const daysDiff = differenceInDays(today, lastActivity);

  if (daysDiff === 0) {
    // Same day activity, streak unchanged
    logger.debug("[Streak] Same day activity, streak unchanged");
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

export async function getStreak(userId?: number | null): Promise<Streak | null> {
  const streak = await streakRepository.findByUserId(userId || null);
  return streak ?? null;
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

  // Get all progress logs ordered by date
  const allProgress = await progressRepository.getAllProgressOrdered();

  if (allProgress.length === 0) {
    logger.info("[Streak] No progress data found, creating empty streak");
    return await getOrCreateStreak(userId);
  }

  // Group progress by date and calculate daily activity
  const dailyActivity = new Map<string, number>();
  const uniqueDates = new Set<string>();

  allProgress.forEach((progress) => {
    const dateKey = progress.progressDate.toISOString().split('T')[0]; // YYYY-MM-DD
    const pagesRead = progress.pagesRead || 0;

    if (pagesRead > 0) {
      uniqueDates.add(dateKey);
      dailyActivity.set(dateKey, (dailyActivity.get(dateKey) || 0) + pagesRead);
    }
  });

  const sortedDates = Array.from(uniqueDates).sort();

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

  const totalDaysActive = uniqueDates.size;

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

export async function getActivityCalendar(
  userId?: number | null,
  year?: number,
  month?: number
): Promise<{ date: string; pagesRead: number }[]> {
  const startDate = new Date(year || new Date().getFullYear(), month || 0, 1);
  const endDate = new Date(
    year || new Date().getFullYear(),
    (month !== undefined ? month : 11) + 1,
    0
  );

  return await progressRepository.getActivityCalendar(startDate, endDate);
}
