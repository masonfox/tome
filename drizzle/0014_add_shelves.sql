-- Create shelves table
CREATE TABLE `shelves` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer,
	`name` text NOT NULL,
	`description` text,
	`color` text,
	`icon` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint

-- Create book_shelves junction table
CREATE TABLE `book_shelves` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`shelf_id` integer NOT NULL,
	`book_id` integer NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`added_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`shelf_id`) REFERENCES `shelves`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint

-- Create indexes for shelves table
CREATE INDEX `idx_shelves_user` ON `shelves` (`user_id`);
--> statement-breakpoint

-- Create indexes for book_shelves table
CREATE INDEX `idx_book_shelves_shelf` ON `book_shelves` (`shelf_id`);
--> statement-breakpoint
CREATE INDEX `idx_book_shelves_book` ON `book_shelves` (`book_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_book_shelves_unique` ON `book_shelves` (`shelf_id`,`book_id`);
--> statement-breakpoint
CREATE INDEX `idx_book_shelves_shelf_order` ON `book_shelves` (`shelf_id`,`sort_order`);
