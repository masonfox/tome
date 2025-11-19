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

export async function rebuildStreak(userId?: string): Promise<IStreak> {
  await connectDB();

  console.log("[Streak] rebuildStreak called for userId:", userId || null);

  // Get all progress logs across all books and sessions
  const progressLogs = await ProgressLog.find({
    userId: userId || null,
  })
    .sort({ progressDate: 1 }) // Ascending order for processing
    .lean();

  console.log(`[Streak] Found ${progressLogs.length} progress logs to analyze`);

  if (progressLogs.length === 0) {
    // No progress logs - reset streak to zeros
    console.log("[Streak] No progress logs found, resetting streak to zeros");
    const streak = await Streak.findOneAndUpdate(
      { userId: userId || null },
      {
        currentStreak: 0,
        longestStreak: 0,
        lastActivityDate: new Date(),
        streakStartDate: new Date(),
        totalDaysActive: 0,
      },
      { upsert: true, new: true }
    );
    return streak;
  }

  // Extract unique dates (normalized to start of day)
  const uniqueDatesSet = new Set<string>();
  progressLogs.forEach((log) => {
    const dateStr = startOfDay(new Date(log.progressDate)).toISOString();
    uniqueDatesSet.add(dateStr);
  });

  // Convert to sorted array (oldest to newest)
  const uniqueDates = Array.from(uniqueDatesSet)
    .map((dateStr) => new Date(dateStr))
    .sort((a, b) => a.getTime() - b.getTime());

  console.log(`[Streak] Found ${uniqueDates.length} unique activity dates`);

  // Calculate total days active
  const totalDaysActive = uniqueDates.length;

  // Calculate current streak by walking backwards from most recent date
  const today = startOfDay(new Date());
  const lastActivityDate = uniqueDates[uniqueDates.length - 1];

  let currentStreak = 0;
  let streakStartDate = lastActivityDate;

  // Check if the streak is still active (last activity was today or yesterday)
  const daysSinceLastActivity = differenceInDays(today, lastActivityDate);

  if (daysSinceLastActivity <= 1) {
    // Streak is active or can continue if we log today
    currentStreak = 1;

    // Walk backwards to find consecutive days
    for (let i = uniqueDates.length - 2; i >= 0; i--) {
      const currentDate = uniqueDates[i];
      const nextDate = uniqueDates[i + 1];
      const diff = differenceInDays(nextDate, currentDate);

      if (diff === 1) {
        // Consecutive day
        currentStreak++;
        streakStartDate = currentDate;
      } else {
        // Streak broken
        break;
      }
    }
  } else {
    // Streak is broken (no activity today or yesterday)
    console.log(`[Streak] Streak is broken (${daysSinceLastActivity} days since last activity)`);
    currentStreak = 0;
    streakStartDate = today;
  }

  // Calculate longest streak by examining all date pairs
  let longestStreak = 0;
  let tempStreak = 1;

  for (let i = 1; i < uniqueDates.length; i++) {
    const prevDate = uniqueDates[i - 1];
    const currentDate = uniqueDates[i];
    const diff = differenceInDays(currentDate, prevDate);

    if (diff === 1) {
      tempStreak++;
      longestStreak = Math.max(longestStreak, tempStreak);
    } else {
      tempStreak = 1;
    }
  }
  longestStreak = Math.max(longestStreak, tempStreak, currentStreak);

  console.log("[Streak] Calculated streak stats:", {
    currentStreak,
    longestStreak,
    totalDaysActive,
    lastActivityDate: lastActivityDate.toISOString(),
    streakStartDate: streakStartDate.toISOString(),
  });

  // Update or create streak record
  const streak = await Streak.findOneAndUpdate(
    { userId: userId || null },
    {
      currentStreak,
      longestStreak,
      lastActivityDate,
      streakStartDate,
      totalDaysActive,
    },
    { upsert: true, new: true }
  );

  console.log("[Streak] Streak rebuilt and saved successfully");
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
