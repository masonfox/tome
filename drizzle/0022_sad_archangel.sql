CREATE TABLE `book_sources` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`book_id` integer NOT NULL,
	`provider_id` text NOT NULL,
	`external_id` text,
	`is_primary` integer DEFAULT false NOT NULL,
	`last_synced` integer,
	`sync_enabled` integer DEFAULT true NOT NULL,
	`metadata` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_book_sources_book_id` ON `book_sources` (`book_id`);--> statement-breakpoint
CREATE INDEX `idx_book_sources_provider_id` ON `book_sources` (`provider_id`);--> statement-breakpoint
CREATE INDEX `idx_book_sources_external_id` ON `book_sources` (`external_id`);--> statement-breakpoint
CREATE INDEX `idx_book_sources_is_primary` ON `book_sources` (`is_primary`);--> statement-breakpoint
CREATE UNIQUE INDEX `book_sources_book_provider_unique` ON `book_sources` (`book_id`,`provider_id`);--> statement-breakpoint
DROP INDEX `idx_books_source`;--> statement-breakpoint
ALTER TABLE `books` DROP COLUMN `source`;