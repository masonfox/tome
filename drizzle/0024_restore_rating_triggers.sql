-- Restore CHECK constraint triggers for books.rating (1-5)
-- These were dropped by migration 0022 which recreated the books table
CREATE TRIGGER books_rating_check_insert
  BEFORE INSERT ON books
  WHEN NEW.rating IS NOT NULL AND (NEW.rating < 1 OR NEW.rating > 5)
BEGIN
  SELECT RAISE(ABORT, 'rating must be between 1 and 5');
END;--> statement-breakpoint
CREATE TRIGGER books_rating_check_update
  BEFORE UPDATE ON books
  WHEN NEW.rating IS NOT NULL AND (NEW.rating < 1 OR NEW.rating > 5)
BEGIN
  SELECT RAISE(ABORT, 'rating must be between 1 and 5');
END;
