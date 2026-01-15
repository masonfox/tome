PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_streaks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer,
	`streak_enabled` integer DEFAULT false NOT NULL,
	`current_streak` integer DEFAULT 0 NOT NULL,
	`longest_streak` integer DEFAULT 0 NOT NULL,
	`last_activity_date` text NOT NULL,
	`streak_start_date` text NOT NULL,
	`total_days_active` integer DEFAULT 0 NOT NULL,
	`daily_threshold` integer DEFAULT 1 NOT NULL,
	`user_timezone` text DEFAULT 'America/New_York' NOT NULL,
	`last_checked_date` text,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_streaks`("id", "user_id", "streak_enabled", "current_streak", "longest_streak", "last_activity_date", "streak_start_date", "total_days_active", "daily_threshold", "user_timezone", "last_checked_date", "updated_at") SELECT "id", "user_id", "streak_enabled", "current_streak", "longest_streak", "last_activity_date", "streak_start_date", "total_days_active", "daily_threshold", "user_timezone", "last_checked_date", "updated_at" FROM `streaks`;--> statement-breakpoint
DROP TABLE `streaks`;--> statement-breakpoint
ALTER TABLE `__new_streaks` RENAME TO `streaks`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_streak_user` ON `streaks` (COALESCE("user_id", -1));