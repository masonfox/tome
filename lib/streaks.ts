import { startOfDay, differenceInDays } from "date-fns";
import { streakRepository, progressRepository } from "@/lib/repositories";
import type { Streak } from "@/lib/db/schema/streaks";

export async function updateStreaks(userId?: number | null): Promise<Streak> {
  console.log("[Streak] updateStreaks called with userId:", userId || null);

  // Get or create streak record
  let streak = await streakRepository.findByUserId(userId || null);

  if (!streak) {
    console.log("[Streak] No existing streak found, creating new one");
    const now = new Date();
    streak = await streakRepository.create({
      userId: userId || null,
      currentStreak: 1,
      longestStreak: 1,
      lastActivityDate: now,
      streakStartDate: now,
      totalDaysActive: 1,
    });
    console.log("[Streak] New streak created:", {
      currentStreak: streak.currentStreak,
      longestStreak: streak.longestStreak,
      lastActivityDate: streak.lastActivityDate,
      streakStartDate: streak.streakStartDate,
      totalDaysActive: streak.totalDaysActive,
    });
    return streak;
  }

  // Get today's progress to check if there's activity
  const today = startOfDay(new Date());
  const todayProgress = await progressRepository.getProgressForDate(today);

  if (!todayProgress || todayProgress.pagesRead === 0) {
    // No activity today, return existing streak
    console.log("[Streak] No activity today, returning existing streak");
    return streak;
  }

  // Has activity today, check if it's consecutive
  const lastActivity = startOfDay(streak.lastActivityDate);
  const daysDiff = differenceInDays(today, lastActivity);

  if (daysDiff === 0) {
    // Same day activity, streak unchanged
    console.log("[Streak] Same day activity, streak unchanged");
    return streak;
  } else if (daysDiff === 1) {
    // Consecutive day, increment streak
    console.log("[Streak] Consecutive day activity, incrementing streak");
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
    console.log("[Streak] Streak incremented:", {
      from: oldStreak,
      to: updated?.currentStreak,
      longestStreak: updated?.longestStreak,
    });
    return updated!;
  } else if (daysDiff > 1) {
    // Streak broken (or first activity after a gap)
    console.log("[Streak] Streak broken (gap of", daysDiff, "days), resetting to 1");
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
  return await streakRepository.findByUserId(userId || null);
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

export async function rebuildStreak(userId?: number | null): Promise<Streak> {
  console.log("[Streak] Rebuilding streak from all progress data");

  // Get all progress logs ordered by date
  const allProgress = await progressRepository.getAllProgressOrdered();

  if (allProgress.length === 0) {
    console.log("[Streak] No progress data found, creating empty streak");
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
      const currentDate = new Date(sortedDates[i]);
      const prevDate = new Date(sortedDates[i - 1]);
      const daysDiff = differenceInDays(currentDate, prevDate);

      if (daysDiff === 1) {
        // Consecutive day
        currentStreak++;
      } else {
        // Gap in streak
        longestStreak = Math.max(longestStreak, currentStreak);
        currentStreak = 1;
        streakStartDate = currentDate;
      }
      lastActivityDate = currentDate;
    }

    longestStreak = Math.max(longestStreak, currentStreak);
  }

  const totalDaysActive = uniqueDates.size;

  console.log("[Streak] Calculated streak stats:", {
    currentStreak,
    longestStreak,
    totalDaysActive,
    lastActivityDate: lastActivityDate.toISOString(),
    streakStartDate: streakStartDate.toISOString(),
  });

  // Update or create streak record
  const streak = await streakRepository.upsert(userId || null, {
    currentStreak,
    longestStreak,
    lastActivityDate: lastActivityDate,
    streakStartDate: streakStartDate,
    totalDaysActive,
  });

  console.log("[Streak] Streak rebuilt and saved successfully");
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