PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_progress_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer,
	`book_id` integer NOT NULL,
	`session_id` integer,
	`current_page` integer DEFAULT 0 NOT NULL,
	`current_percentage` real DEFAULT 0 NOT NULL,
	`progress_date` text NOT NULL,
	`notes` text,
	`pages_read` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`session_id`) REFERENCES `reading_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "current_page_check" CHECK("__new_progress_logs"."current_page" >= 0),
	CONSTRAINT "current_percentage_check" CHECK("__new_progress_logs"."current_percentage" >= 0 AND "__new_progress_logs"."current_percentage" <= 100),
	CONSTRAINT "pages_read_check" CHECK("__new_progress_logs"."pages_read" >= 0)
);
--> statement-breakpoint
INSERT INTO `__new_progress_logs`("id", "user_id", "book_id", "session_id", "current_page", "current_percentage", "progress_date", "notes", "pages_read", "created_at") SELECT "id", "user_id", "book_id", "session_id", "current_page", "current_percentage", "progress_date", "notes", "pages_read", "created_at" FROM `progress_logs`;--> statement-breakpoint
DROP TABLE `progress_logs`;--> statement-breakpoint
ALTER TABLE `__new_progress_logs` RENAME TO `progress_logs`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_progress_book_date` ON `progress_logs` (`book_id`,`progress_date`);--> statement-breakpoint
CREATE INDEX `idx_progress_session_date` ON `progress_logs` (`session_id`,`progress_date`);--> statement-breakpoint
CREATE INDEX `idx_progress_user_date` ON `progress_logs` (`user_id`,`progress_date`);--> statement-breakpoint
CREATE INDEX `idx_progress_date` ON `progress_logs` (`progress_date`);