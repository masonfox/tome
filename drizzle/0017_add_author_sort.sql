ALTER TABLE `books` ADD `author_sort` text;--> statement-breakpoint
CREATE INDEX `idx_books_author_sort` ON `books` (`author_sort`);