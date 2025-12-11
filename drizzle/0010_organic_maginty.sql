CREATE TABLE `reading_goals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer,
	`year` integer NOT NULL,
	`books_goal` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT "books_goal_check" CHECK("reading_goals"."books_goal" >= 1),
	CONSTRAINT "year_range_check" CHECK("reading_goals"."year" >= 1900 AND "reading_goals"."year" <= 9999)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_goal_user_year` ON `reading_goals` (COALESCE(`user_id`, -1), `year`);--> statement-breakpoint
CREATE INDEX `idx_goal_year` ON `reading_goals` (`year`);