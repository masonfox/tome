PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_reading_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer,
	`book_id` integer NOT NULL,
	`session_number` integer NOT NULL,
	`status` text DEFAULT 'to-read' NOT NULL,
	`started_date` integer,
	`completed_date` integer,
	`review` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_reading_sessions`("id", "user_id", "book_id", "session_number", "status", "started_date", "completed_date", "review", "is_active", "created_at", "updated_at") SELECT "id", "user_id", "book_id", "session_number", "status", "started_date", "completed_date", "review", "is_active", "created_at", "updated_at" FROM `reading_sessions`;--> statement-breakpoint
DROP TABLE `reading_sessions`;--> statement-breakpoint
ALTER TABLE `__new_reading_sessions` RENAME TO `reading_sessions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_book_session` ON `reading_sessions` (`book_id`,`session_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_active_session` ON `reading_sessions` (`book_id`) WHERE "reading_sessions"."is_active" = 1;--> statement-breakpoint
CREATE INDEX `idx_sessions_book_id` ON `reading_sessions` (`book_id`);--> statement-breakpoint
CREATE INDEX `idx_sessions_status` ON `reading_sessions` (`status`);--> statement-breakpoint
CREATE INDEX `idx_sessions_user_book` ON `reading_sessions` (`user_id`,`book_id`);