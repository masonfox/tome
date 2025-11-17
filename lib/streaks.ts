import { startOfDay, differenceInDays } from "date-fns";
import Streak, { IStreak } from "@/models/Streak";
import ProgressLog from "@/models/ProgressLog";
import { connectDB } from "@/lib/db/mongodb";

export async function updateStreaks(userId?: string): Promise<IStreak> {
  await connectDB();

  console.log("[Streak] updateStreaks called with userId:", userId || null);

  // Get or create streak record
  let streak = await Streak.findOne({ userId: userId || null });

  if (!streak) {
    console.log("[Streak] No existing streak found, creating new one");
    streak = new Streak({
      userId: userId || null,
      currentStreak: 1,
      longestStreak: 1,
      lastActivityDate: new Date(),
      streakStartDate: new Date(),
      totalDaysActive: 1,
    });
    await streak.save();
    console.log("[Streak] New streak created:", {
      currentStreak: streak.currentStreak,
      longestStreak: streak.longestStreak,
      lastActivityDate: streak.lastActivityDate,
    });
    return streak;
  }

  console.log("[Streak] Found existing streak:", {
    currentStreak: streak.currentStreak,
    longestStreak: streak.longestStreak,
    lastActivityDate: streak.lastActivityDate,
    totalDaysActive: streak.totalDaysActive,
  });

  const today = startOfDay(new Date());
  const lastActivity = startOfDay(new Date(streak.lastActivityDate));

  const daysDiff = differenceInDays(today, lastActivity);
  console.log("[Streak] Day difference:", daysDiff, {
    today: today.toISOString(),
    lastActivity: lastActivity.toISOString(),
  });

  if (daysDiff === 0) {
    // Same day - check if this is the first activity ever
    if (streak.currentStreak === 0) {
      console.log("[Streak] First activity ever, initializing streak to 1");
      streak.currentStreak = 1;
      streak.longestStreak = 1;
      streak.totalDaysActive = 1;
      streak.lastActivityDate = today;
      await streak.save();
      console.log("[Streak] Streak initialized:", {
        currentStreak: streak.currentStreak,
        longestStreak: streak.longestStreak,
        lastActivityDate: streak.lastActivityDate,
        totalDaysActive: streak.totalDaysActive,
      });
      return streak;
    }
    // Same day, already logged activity today
    console.log("[Streak] Same day activity, no changes needed");
    return streak;
  } else if (daysDiff === 1) {
    // Consecutive day, increment
    if (streak.currentStreak === 0) {
      // Edge case: streak was created with 0s yesterday, treat as first activity
      console.log("[Streak] First activity (1 day after creation), initializing to 1");
      streak.currentStreak = 1;
      streak.longestStreak = 1;
      streak.totalDaysActive = 1;
    } else {
      console.log("[Streak] Consecutive day detected, incrementing streak");
      const oldStreak = streak.currentStreak;
      streak.currentStreak += 1;
      streak.longestStreak = Math.max(
        streak.longestStreak,
        streak.currentStreak
      );
      streak.totalDaysActive += 1;
      console.log("[Streak] Streak incremented:", {
        from: oldStreak,
        to: streak.currentStreak,
        longestStreak: streak.longestStreak,
      });
    }
  } else if (daysDiff > 1) {
    // Streak broken (or first activity after a gap)
    console.log("[Streak] Streak broken (gap of", daysDiff, "days), resetting to 1");
    streak.currentStreak = 1;
    streak.streakStartDate = today;
    streak.totalDaysActive = streak.totalDaysActive === 0 ? 1 : streak.totalDaysActive + 1;
  }

  streak.lastActivityDate = today;
  console.log("[Streak] Saving updated streak...");
  await streak.save();
  console.log("[Streak] Streak saved successfully:", {
    currentStreak: streak.currentStreak,
    longestStreak: streak.longestStreak,
    lastActivityDate: streak.lastActivityDate,
    totalDaysActive: streak.totalDaysActive,
  });

  return streak;
}

export async function getStreak(userId?: string): Promise<IStreak | null> {
  await connectDB();
  return await Streak.findOne({ userId: userId || null });
}

export async function getOrCreateStreak(userId?: string): Promise<IStreak> {
  await connectDB();

  let streak = await Streak.findOne({ userId: userId || null });

  if (!streak) {
    streak = new Streak({
      userId: userId || null,
      currentStreak: 0,
      longestStreak: 0,
      lastActivityDate: new Date(),
      streakStartDate: new Date(),
      totalDaysActive: 0,
    });
    await streak.save();
  }

  return streak;
}

export async function getActivityCalendar(
  userId?: string,
  year?: number,
  month?: number
): Promise<{ date: string; pagesRead: number }[]> {
  await connectDB();

  const startDate = new Date(year || new Date().getFullYear(), month || 0, 1);
  const endDate = new Date(
    year || new Date().getFullYear(),
    (month !== undefined ? month : 11) + 1,
    0
  );

  const progressLogs = await ProgressLog.aggregate([
    {
      $match: {
        userId: userId || null,
        progressDate: {
          $gte: startDate,
          $lte: endDate,
        },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%d", date: "$progressDate" },
        },
        pagesRead: { $sum: "$pagesRead" },
      },
    },
    {
      $sort: { _id: 1 },
    },
  ]);

  return progressLogs.map((log) => ({
    date: log._id,
    pagesRead: log.pagesRead,
  }));
}
