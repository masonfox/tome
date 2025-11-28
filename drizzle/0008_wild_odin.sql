ALTER TABLE `streaks` ADD `user_timezone` text DEFAULT 'America/New_York' NOT NULL;--> statement-breakpoint
ALTER TABLE `streaks` ADD `last_checked_date` integer;