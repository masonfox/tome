-- Add CHECK constraint triggers for books.rating (1-5)
CREATE TRIGGER books_rating_check_insert
  BEFORE INSERT ON books
  WHEN NEW.rating IS NOT NULL AND (NEW.rating < 1 OR NEW.rating > 5)
BEGIN
  SELECT RAISE(ABORT, 'rating must be between 1 and 5');
END;

CREATE TRIGGER books_rating_check_update
  BEFORE UPDATE ON books
  WHEN NEW.rating IS NOT NULL AND (NEW.rating < 1 OR NEW.rating > 5)
BEGIN
  SELECT RAISE(ABORT, 'rating must be between 1 and 5');
END;
