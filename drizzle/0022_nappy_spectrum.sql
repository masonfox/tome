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
	`source` text DEFAULT 'calibre' NOT NULL,
	`external_id` text,
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
INSERT INTO `__new_books`("id", "calibre_id", "source", "external_id", "title", "authors", "author_sort", "isbn", "total_pages", "added_to_library", "last_synced", "publisher", "pub_date", "series", "series_index", "tags", "path", "description", "rating", "orphaned", "orphaned_at", "created_at", "updated_at") SELECT "id", "calibre_id", 'calibre', CAST("calibre_id" AS TEXT), "title", "authors", "author_sort", "isbn", "total_pages", "added_to_library", "last_synced", "publisher", "pub_date", "series", "series_index", "tags", "path", "description", "rating", "orphaned", "orphaned_at", "created_at", "updated_at" FROM `books`;--> statement-breakpoint
DROP TABLE `books`;--> statement-breakpoint
ALTER TABLE `__new_books` RENAME TO `books`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `books_calibre_id_unique` ON `books` (`calibre_id`);--> statement-breakpoint
CREATE INDEX `idx_books_author_sort` ON `books` (`author_sort`);--> statement-breakpoint
CREATE INDEX `idx_books_source` ON `books` (`source`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_books_source_external` ON `books` (`source`,`external_id`) WHERE external_id IS NOT NULL;