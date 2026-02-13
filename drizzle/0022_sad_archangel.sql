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
CREATE TABLE `provider_configs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`provider` text NOT NULL,
	`display_name` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`capabilities` text NOT NULL,
	`settings` text DEFAULT '{}' NOT NULL,
	`credentials` text DEFAULT '{}',
	`circuit_state` text DEFAULT 'CLOSED' NOT NULL,
	`last_failure` integer,
	`failure_count` integer DEFAULT 0 NOT NULL,
	`health_status` text DEFAULT 'healthy' NOT NULL,
	`last_health_check` integer,
	`priority` integer DEFAULT 100 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `provider_configs_provider_unique` ON `provider_configs` (`provider`);--> statement-breakpoint
CREATE INDEX `idx_provider_configs_enabled` ON `provider_configs` (`enabled`);--> statement-breakpoint
CREATE INDEX `idx_provider_configs_priority` ON `provider_configs` (`priority`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_books` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`calibre_id` integer,
	`title` text NOT NULL,
	`authors` text DEFAULT '[]' NOT NULL,
	`author_sort` text,
	`isbn` text,
	`total_pages` integer,
	`added_to_library` integer DEFAULT (unixepoch()) NOT NULL,
	`last_synced` integer,
	`publisher` text,
	`pub_date` integer,
	`series` text,
	`series_index` real,
	`tags` text DEFAULT '[]' NOT NULL,
	`path` text,
	`description` text,
	`rating` integer,
	`orphaned` integer DEFAULT false NOT NULL,
	`orphaned_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_books`("id", "calibre_id", "title", "authors", "author_sort", "isbn", "total_pages", "added_to_library", "last_synced", "publisher", "pub_date", "series", "series_index", "tags", "path", "description", "rating", "orphaned", "orphaned_at", "created_at", "updated_at") SELECT "id", "calibre_id", "title", "authors", "author_sort", "isbn", "total_pages", "added_to_library", "last_synced", "publisher", "pub_date", "series", "series_index", "tags", "path", "description", "rating", "orphaned", "orphaned_at", "created_at", "updated_at" FROM `books`;--> statement-breakpoint
DROP TABLE `books`;--> statement-breakpoint
ALTER TABLE `__new_books` RENAME TO `books`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `books_calibre_id_unique` ON `books` (`calibre_id`);--> statement-breakpoint
CREATE INDEX `idx_books_author_sort` ON `books` (`author_sort`);