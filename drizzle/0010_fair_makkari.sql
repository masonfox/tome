CREATE TABLE `import_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`file_name` text NOT NULL,
	`file_size` integer NOT NULL,
	`provider` text NOT NULL,
	`total_records` integer DEFAULT 0 NOT NULL,
	`matched_records` integer DEFAULT 0 NOT NULL,
	`unmatched_records` integer DEFAULT 0 NOT NULL,
	`sessions_created` integer DEFAULT 0 NOT NULL,
	`sessions_skipped` integer DEFAULT 0 NOT NULL,
	`ratings_sync` integer DEFAULT 0 NOT NULL,
	`calibre_sync_failures` integer DEFAULT 0 NOT NULL,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	`status` text DEFAULT 'pending' NOT NULL,
	`error_message` text,
	`user_id` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_import_logs_user_created` ON `import_logs` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_import_logs_status_created` ON `import_logs` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_import_logs_provider_created` ON `import_logs` (`provider`,`created_at`);--> statement-breakpoint
CREATE TABLE `import_unmatched_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`import_log_id` integer NOT NULL,
	`title` text NOT NULL,
	`authors` text NOT NULL,
	`isbn` text,
	`isbn13` text,
	`rating` integer,
	`completed_date` integer,
	`status` text NOT NULL,
	`review` text,
	`match_attempted` integer DEFAULT true NOT NULL,
	`match_reason` text NOT NULL,
	`confidence` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`import_log_id`) REFERENCES `import_logs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_unmatched_import_log` ON `import_unmatched_records` (`import_log_id`);--> statement-breakpoint
CREATE INDEX `idx_unmatched_reason` ON `import_unmatched_records` (`match_reason`);--> statement-breakpoint
CREATE INDEX `idx_unmatched_title` ON `import_unmatched_records` (`title`);