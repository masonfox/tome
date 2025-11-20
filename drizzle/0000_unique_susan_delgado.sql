CREATE TABLE `books` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`calibre_id` integer NOT NULL,
	`title` text NOT NULL,
	`authors` text DEFAULT '[]' NOT NULL,
	`isbn` text,
	`total_pages` integer,
	`added_to_library` integer DEFAULT (unixepoch()) NOT NULL,
	`last_synced` integer DEFAULT (unixepoch()) NOT NULL,
	`publisher` text,
	`pub_date` integer,
	`series` text,
	`series_index` real,
	`tags` text DEFAULT '[]' NOT NULL,
	`path` text NOT NULL,
	`description` text,
	`orphaned` integer DEFAULT false NOT NULL,
	`orphaned_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `books_calibre_id_unique` ON `books` (`calibre_id`);--> statement-breakpoint
CREATE TABLE `reading_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer,
	`book_id` integer NOT NULL,
	`session_number` integer NOT NULL,
	`status` text DEFAULT 'to-read' NOT NULL,
	`started_date` integer,
	`completed_date` integer,
	`rating` integer,
	`review` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_book_session` ON `reading_sessions` (`book_id`,`session_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_active_session` ON `reading_sessions` (`book_id`) WHERE "reading_sessions"."is_active" = 1;--> statement-breakpoint
CREATE INDEX `idx_sessions_book_id` ON `reading_sessions` (`book_id`);--> statement-breakpoint
CREATE INDEX `idx_sessions_status` ON `reading_sessions` (`status`);--> statement-breakpoint
CREATE INDEX `idx_sessions_user_book` ON `reading_sessions` (`user_id`,`book_id`);--> statement-breakpoint
CREATE TABLE `progress_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer,
	`book_id` integer NOT NULL,
	`session_id` integer,
	`current_page` integer DEFAULT 0 NOT NULL,
	`current_percentage` real DEFAULT 0 NOT NULL,
	`progress_date` integer DEFAULT (unixepoch()) NOT NULL,
	`notes` text,
	`pages_read` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`session_id`) REFERENCES `reading_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_progress_book_date` ON `progress_logs` (`book_id`,`progress_date`);--> statement-breakpoint
CREATE INDEX `idx_progress_session_date` ON `progress_logs` (`session_id`,`progress_date`);--> statement-breakpoint
CREATE INDEX `idx_progress_user_date` ON `progress_logs` (`user_id`,`progress_date`);--> statement-breakpoint
CREATE INDEX `idx_progress_date` ON `progress_logs` (`progress_date`);--> statement-breakpoint
CREATE TABLE `streaks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer,
	`current_streak` integer DEFAULT 0 NOT NULL,
	`longest_streak` integer DEFAULT 0 NOT NULL,
	`last_activity_date` integer DEFAULT (unixepoch()) NOT NULL,
	`streak_start_date` integer DEFAULT (unixepoch()) NOT NULL,
	`total_days_active` integer DEFAULT 0 NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_streak_user` ON `streaks` (`user_id`);