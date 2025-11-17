import { startOfDay, differenceInDays } from "date-fns";
import Streak, { IStreak } from "@/models/Streak";
import ProgressLog from "@/models/ProgressLog";
import { connectDB } from "@/lib/db/mongodb";

export async function updateStreaks(userId?: string): Promise<IStreak> {
  await connectDB();

  // Get or create streak record
  let streak = await Streak.findOne({ userId: userId || null });

  if (!streak) {
    streak = new Streak({
      userId: userId || null,
      currentStreak: 1,
      longestStreak: 1,
      lastActivityDate: new Date(),
      streakStartDate: new Date(),
      totalDaysActive: 1,
    });
    await streak.save();
    return streak;
  }

  const today = startOfDay(new Date());
  const lastActivity = startOfDay(new Date(streak.lastActivityDate));

  const daysDiff = differenceInDays(today, lastActivity);

  if (daysDiff === 0) {
    // Same day, no change
    return streak;
  } else if (daysDiff === 1) {
    // Consecutive day, increment
    streak.currentStreak += 1;
    streak.longestStreak = Math.max(
      streak.longestStreak,
      streak.currentStreak
    );
    streak.totalDaysActive += 1;
  } else if (daysDiff > 1) {
    // Streak broken
    streak.currentStreak = 1;
    streak.streakStartDate = today;
    streak.totalDaysActive += 1;
  }

  streak.lastActivityDate = today;
  await streak.save();

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
