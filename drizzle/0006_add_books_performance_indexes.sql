-- Add performance indexes to books table
-- These indexes significantly improve query performance for common filtering and sorting operations

-- Index on title for search queries (LIKE operations)
CREATE INDEX IF NOT EXISTS idx_books_title ON books(title);--> statement-breakpoint
-- Index on rating for filtering by rating
CREATE INDEX IF NOT EXISTS idx_books_rating ON books(rating);--> statement-breakpoint
-- Index on created_at for sorting by creation date (most common sort)
CREATE INDEX IF NOT EXISTS idx_books_created_at ON books(created_at);--> statement-breakpoint
-- Index on orphaned for filtering orphaned books
CREATE INDEX IF NOT EXISTS idx_books_orphaned ON books(orphaned);--> statement-breakpoint
-- Composite index on (orphaned, created_at) for the most common query pattern:
-- filtering out orphaned books and sorting by created_at
CREATE INDEX IF NOT EXISTS idx_books_orphaned_created ON books(orphaned, created_at);--> statement-breakpoint
-- Update statistics to help the query planner make better decisions
ANALYZE books;
