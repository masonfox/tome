import { sqliteTable, integer, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const streaks = sqliteTable(
  "streaks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id"), // Nullable for single-user mode
    streakEnabled: integer("streak_enabled", { mode: "boolean" }).notNull().default(false), // Opt-in streak tracking
    currentStreak: integer("current_streak").notNull().default(0),
    longestStreak: integer("longest_streak").notNull().default(0),
    lastActivityDate: text("last_activity_date").notNull(), // YYYY-MM-DD format
    streakStartDate: text("streak_start_date").notNull(), // YYYY-MM-DD format
    totalDaysActive: integer("total_days_active").notNull().default(0),
    dailyThreshold: integer("daily_threshold").notNull().default(1),
    userTimezone: text("user_timezone").notNull().default("America/New_York"),
    lastCheckedDate: text("last_checked_date"), // YYYY-MM-DD format
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  },
  (table) => ({
    // Singleton pattern: one streak per user (COALESCE to handle NULL values)
    userIdx: uniqueIndex("idx_streak_user").on(sql`COALESCE(${table.userId}, -1)`),
  })
);

export type Streak = typeof streaks.$inferSelect;
export type NewStreak = typeof streaks.$inferInsert;
