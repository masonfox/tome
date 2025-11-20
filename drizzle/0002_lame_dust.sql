DROP INDEX `idx_streak_user`;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_streak_user` ON `streaks` (COALESCE("user_id", -1));