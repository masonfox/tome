CREATE TABLE `application_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `koreader_document_mappings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`document_hash` text NOT NULL,
	`book_id` integer NOT NULL,
	`mapping_source` text NOT NULL,
	`device_name` text,
	`last_synced_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `koreader_document_mappings_document_hash_unique` ON `koreader_document_mappings` (`document_hash`);--> statement-breakpoint
CREATE INDEX `koreader_mapping_book_id_idx` ON `koreader_document_mappings` (`book_id`);--> statement-breakpoint
CREATE TABLE `koreader_sync_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`document_hash` text NOT NULL,
	`username` text,
	`percentage` real,
	`device` text,
	`upstream_status` integer,
	`tome_processed` integer DEFAULT false,
	`error` text,
	`synced_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `koreader_events_document_hash_idx` ON `koreader_sync_events` (`document_hash`);--> statement-breakpoint
CREATE INDEX `koreader_events_synced_at_idx` ON `koreader_sync_events` (`synced_at`);