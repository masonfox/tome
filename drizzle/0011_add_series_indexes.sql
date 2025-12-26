-- Add indexes for efficient series queries
CREATE INDEX IF NOT EXISTS idx_books_series ON books(series) WHERE series IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_books_series_index ON books(series, series_index) WHERE series IS NOT NULL;
