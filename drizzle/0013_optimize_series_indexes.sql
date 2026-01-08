-- Optimize series indexes for better query performance
-- Replaces the indexes from migration 0010 with more efficient ones

-- Drop old indexes
DROP INDEX IF EXISTS idx_books_series;--> statement-breakpoint
DROP INDEX IF EXISTS idx_books_series_index;--> statement-breakpoint
-- Create optimized composite index for series equality lookups
-- This index is used by getBooksBySeries and getSeriesByName queries
-- Including orphaned in the index allows for index-only scans
CREATE INDEX IF NOT EXISTS idx_books_series_composite 
ON books(series, orphaned, series_index, id) 
WHERE series IS NOT NULL;--> statement-breakpoint
-- Create index for series listing (getAllSeries)
-- Optimized for GROUP BY and ORDER BY operations
CREATE INDEX IF NOT EXISTS idx_books_series_list 
ON books(series, orphaned) 
WHERE series IS NOT NULL;
