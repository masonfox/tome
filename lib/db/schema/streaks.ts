import { sqliteTable, integer, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const streaks = sqliteTable(
  "streaks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id"), // Nullable for single-user mode
    currentStreak: integer("current_streak").notNull().default(0),
    longestStreak: integer("longest_streak").notNull().default(0),
    lastActivityDate: integer("last_activity_date", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
    streakStartDate: integer("streak_start_date", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
    totalDaysActive: integer("total_days_active").notNull().default(0),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  },
  (table) => ({
    // Singleton pattern: one streak per user (COALESCE to handle NULL values)
    userIdx: uniqueIndex("idx_streak_user").on(sql`COALESCE(${table.userId}, -1)`),
  })
);

export type Streak = typeof streaks.$inferSelect;
export type NewStreak = typeof streaks.$inferInsert;
