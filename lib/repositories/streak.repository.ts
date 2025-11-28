import { eq, sql } from "drizzle-orm";
import { BaseRepository } from "./base.repository";
import { streaks, Streak, NewStreak } from "@/lib/db/schema/streaks";
import { db } from "@/lib/db/sqlite";

export class StreakRepository extends BaseRepository<Streak, NewStreak, typeof streaks> {
  constructor() {
    super(streaks);
  }

  /**
   * Find streak by userId (or null for single-user mode)
   */
  async findByUserId(userId: number | null = null): Promise<Streak | undefined> {
    if (userId === null) {
      return this.getDatabase()
        .select()
        .from(streaks)
        .where(sql`${streaks.userId} IS NULL`)
        .get();
    }
    return this.getDatabase().select().from(streaks).where(eq(streaks.userId, userId)).get();
  }

  /**
   * Get or create streak for user
   */
  async getOrCreate(userId: number | null = null): Promise<Streak> {
    let streak = await this.findByUserId(userId);

    if (!streak) {
      const now = new Date();
      streak = await this.create({
        userId,
        currentStreak: 0,
        longestStreak: 0,
        lastActivityDate: now,
        streakStartDate: now,
        totalDaysActive: 0,
      });
    }

    return streak;
  }

  /**
   * Update streak for user (upsert behavior)
   */
  async upsert(userId: number | null, data: Partial<NewStreak>): Promise<Streak> {
    const existing = await this.findByUserId(userId);

    if (existing) {
      const updated = await this.update(existing.id, data);
      if (!updated) {
        throw new Error('Failed to update streak');
      }
      return updated;
    } else {
      const now = new Date();
      const created = await this.create({
        userId,
        currentStreak: 0,
        longestStreak: 0,
        lastActivityDate: now,
        streakStartDate: now,
        totalDaysActive: 0,
        ...data,
      });
      return created;
    }
  }

  /**
   * Increment current streak
   */
  async incrementStreak(userId: number | null = null): Promise<Streak> {
    const streak = await this.getOrCreate(userId);

    const newCurrentStreak = streak.currentStreak + 1;
    const newLongestStreak = Math.max(streak.longestStreak, newCurrentStreak);
    const newTotalDays = streak.totalDaysActive + 1;

    const now = new Date();
    const updated = await this.update(streak.id, {
      currentStreak: newCurrentStreak,
      longestStreak: newLongestStreak,
      totalDaysActive: newTotalDays,
      lastActivityDate: now,
      updatedAt: now,
    } as any);
    if (!updated) {
      throw new Error('Failed to update streak');
    }
    return updated;
  }

  /**
   * Reset current streak but keep longest streak
   */
  async resetCurrentStreak(userId: number | null = null): Promise<Streak> {
    const streak = await this.getOrCreate(userId);

    const now = new Date();
    const updated = await this.update(streak.id, {
      currentStreak: 1,
      streakStartDate: now,
      totalDaysActive: streak.totalDaysActive + 1,
      lastActivityDate: now,
      updatedAt: now,
    } as any);
    if (!updated) {
      throw new Error('Failed to update streak');
    }
    return updated;
  }

  /**
   * Update last activity date
   */
  async updateLastActivity(userId: number | null = null, activityDate: Date = new Date()): Promise<Streak> {
    const streak = await this.getOrCreate(userId);

    const updated = await this.update(streak.id, {
      lastActivityDate: activityDate,
      updatedAt: new Date(),
    } as any);
    if (!updated) {
      throw new Error('Failed to update streak');
    }
    return updated;
  }

  /**
   * Update daily threshold for user
   * Validates that threshold is between 1 and 9999
   */
  async updateThreshold(userId: number | null, dailyThreshold: number): Promise<Streak> {
    // Validation
    if (!Number.isInteger(dailyThreshold)) {
      throw new Error('Daily threshold must be an integer');
    }
    if (dailyThreshold < 1 || dailyThreshold > 9999) {
      throw new Error('Daily threshold must be between 1 and 9999');
    }

    const streak = await this.getOrCreate(userId);

    const updated = await this.update(streak.id, {
      dailyThreshold,
      updatedAt: new Date(),
    } as any);
    if (!updated) {
      throw new Error('Failed to update threshold');
    }
    return updated;
  }

  /**
   * Set timezone for user
   * Validates timezone using Intl.DateTimeFormat
   */
  async setTimezone(userId: number | null, timezone: string): Promise<Streak> {
    // Validate timezone using Intl
    try {
      Intl.DateTimeFormat(undefined, { timeZone: timezone });
    } catch {
      throw new Error(`Invalid timezone: ${timezone}`);
    }

    const streak = await this.getOrCreate(userId);

    const updated = await this.update(streak.id, {
      userTimezone: timezone,
      updatedAt: new Date(),
    } as any);
    if (!updated) {
      throw new Error('Failed to update timezone');
    }
    return updated;
  }

  /**
   * Get timezone for user
   * Returns default if no streak exists
   */
  async getTimezone(userId: number | null): Promise<string> {
    const streak = await this.findByUserId(userId);
    return streak?.userTimezone || 'America/New_York';
  }
}

// Singleton instance
export const streakRepository = new StreakRepository();