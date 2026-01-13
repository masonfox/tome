-- Migration: Reactivate most recent session for books without active sessions
-- Issue: Books marked as "read" or "dnf" were auto-archived (is_active=0),
--        causing UI to display incorrect status on page refresh
-- Fix: Terminal states (read, dnf) now keep sessions active (is_active=1)
-- Date: 2026-01-12

-- Reactivate most recent session for books without active session
UPDATE reading_sessions
SET is_active = 1
WHERE id IN (
  SELECT rs.id FROM reading_sessions rs
  WHERE rs.book_id IN (
    -- Books with no active session
    SELECT b.id FROM books b
    WHERE NOT EXISTS (
      SELECT 1 FROM reading_sessions WHERE book_id = b.id AND is_active = 1
    )
    AND b.orphaned = 0
  )
  AND rs.session_number = (
    SELECT MAX(session_number) FROM reading_sessions WHERE book_id = rs.book_id
  )
);

-- Verification query (run after migration):
-- SELECT 
--   b.id,
--   b.title,
--   COUNT(CASE WHEN rs.is_active = 1 THEN 1 END) as active_sessions,
--   MAX(rs.status) as latest_status
-- FROM books b
-- LEFT JOIN reading_sessions rs ON b.id = rs.book_id
-- WHERE b.orphaned = 0
-- GROUP BY b.id, b.title
-- HAVING active_sessions != 1
-- ORDER BY b.id;
