-- Additional performance indexes for /library page optimization
-- These indexes target specific query patterns for 5,000+ book libraries

-- Index for case-insensitive title searches (LIKE queries)
-- SQLite uses this for LIKE patterns that don't start with wildcard
CREATE INDEX IF NOT EXISTS idx_books_title_search ON books(title COLLATE NOCASE);--> statement-breakpoint
-- Composite index for status filtering with active sessions
-- Optimizes the common pattern: WHERE status = ? AND is_active = 1
CREATE INDEX IF NOT EXISTS idx_sessions_status_active ON reading_sessions(status, is_active) 
WHERE is_active = 1;--> statement-breakpoint
-- Composite index for status + book_id lookups
-- Optimizes finding books by status in the status filter subquery
CREATE INDEX IF NOT EXISTS idx_sessions_status_bookid ON reading_sessions(status, book_id);--> statement-breakpoint
-- Index for progress log queries (used in scalar subqueries)
-- Optimizes: SELECT ... FROM progress_logs WHERE session_id = ? ORDER BY progress_date DESC
CREATE INDEX IF NOT EXISTS idx_progress_session_date ON progress_logs(session_id, progress_date DESC);--> statement-breakpoint
-- Additional index for completed session date ordering
-- Optimizes: ORDER BY completed_date DESC in session subqueries
CREATE INDEX IF NOT EXISTS idx_sessions_completed_date ON reading_sessions(completed_date DESC) 
WHERE status = 'read';--> statement-breakpoint
-- Index for session number ordering (used in tie-breaking)
CREATE INDEX IF NOT EXISTS idx_sessions_session_number ON reading_sessions(book_id, session_number DESC);--> statement-breakpoint
-- Update statistics to help the query planner
ANALYZE books;--> statement-breakpoint
ANALYZE reading_sessions;--> statement-breakpoint
ANALYZE progress_logs;
