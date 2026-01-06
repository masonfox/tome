#!/bin/bash
set -e

# Generate all Calibre test fixtures from production Calibre database
# Creates 3 fixtures: comprehensive, minimal, and series-heavy

SOURCE_DB="/home/mason/Calibre Library/metadata.db"
FIXTURE_DIR="/home/mason/git/tome/__tests__/fixtures"

echo "🚀 Generating all Calibre test fixtures..."
echo "📚 Source: $SOURCE_DB"
echo ""

# Check if source database exists
if [ ! -f "$SOURCE_DB" ]; then
  echo "❌ Error: Source Calibre database not found: $SOURCE_DB"
  exit 1
fi

#==============================================================================
# FUNCTION: Create Calibre Schema
#==============================================================================
create_calibre_schema() {
  local db_path="$1"
  
  sqlite3 "$db_path" <<'EOF'
CREATE TABLE authors ( 
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL COLLATE NOCASE,
  sort TEXT COLLATE NOCASE,
  link TEXT NOT NULL DEFAULT "",
  UNIQUE(name)
);

CREATE TABLE books ( 
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL DEFAULT 'Unknown' COLLATE NOCASE,
  sort TEXT COLLATE NOCASE,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  pubdate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  series_index REAL NOT NULL DEFAULT 1.0,
  author_sort TEXT COLLATE NOCASE,
  isbn TEXT DEFAULT "" COLLATE NOCASE,
  lccn TEXT DEFAULT "" COLLATE NOCASE,
  path TEXT NOT NULL DEFAULT "",
  flags INTEGER NOT NULL DEFAULT 1,
  uuid TEXT,
  has_cover BOOL DEFAULT 0,
  last_modified TIMESTAMP NOT NULL DEFAULT "2000-01-01 00:00:00+00:00"
);

CREATE TABLE books_authors_link ( 
  id INTEGER PRIMARY KEY,
  book INTEGER NOT NULL,
  author INTEGER NOT NULL,
  UNIQUE(book, author)
);

CREATE TABLE books_publishers_link ( 
  id INTEGER PRIMARY KEY,
  book INTEGER NOT NULL,
  publisher INTEGER NOT NULL,
  UNIQUE(book)
);

CREATE TABLE books_ratings_link ( 
  id INTEGER PRIMARY KEY,
  book INTEGER NOT NULL,
  rating INTEGER NOT NULL,
  UNIQUE(book, rating)
);

CREATE TABLE books_series_link ( 
  id INTEGER PRIMARY KEY,
  book INTEGER NOT NULL,
  series INTEGER NOT NULL,
  UNIQUE(book)
);

CREATE TABLE books_tags_link ( 
  id INTEGER PRIMARY KEY,
  book INTEGER NOT NULL,
  tag INTEGER NOT NULL,
  UNIQUE(book, tag)
);

CREATE TABLE comments ( 
  id INTEGER PRIMARY KEY,
  book INTEGER NOT NULL,
  text TEXT NOT NULL COLLATE NOCASE,
  UNIQUE(book)
);

CREATE TABLE identifiers ( 
  id INTEGER PRIMARY KEY,
  book INTEGER NOT NULL,
  type TEXT NOT NULL DEFAULT "isbn" COLLATE NOCASE,
  val TEXT NOT NULL COLLATE NOCASE,
  UNIQUE(book, type)
);

CREATE TABLE publishers ( 
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL COLLATE NOCASE,
  sort TEXT COLLATE NOCASE, 
  link TEXT NOT NULL DEFAULT '',
  UNIQUE(name)
);

CREATE TABLE ratings ( 
  id INTEGER PRIMARY KEY,
  rating INTEGER CHECK(rating > -1 AND rating < 11), 
  link TEXT NOT NULL DEFAULT '',
  UNIQUE (rating)
);

CREATE TABLE series ( 
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL COLLATE NOCASE,
  sort TEXT COLLATE NOCASE, 
  link TEXT NOT NULL DEFAULT '',
  UNIQUE (name)
);

CREATE TABLE tags ( 
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL COLLATE NOCASE, 
  link TEXT NOT NULL DEFAULT '',
  UNIQUE (name)
);

CREATE TABLE data ( 
  id INTEGER PRIMARY KEY,
  book INTEGER NOT NULL,
  format TEXT NOT NULL COLLATE NOCASE,
  uncompressed_size INTEGER NOT NULL,
  name TEXT NOT NULL,
  UNIQUE(book, format)
);
EOF
}

#==============================================================================
# FIXTURE 1: Comprehensive (47 books with diverse metadata)
#==============================================================================
generate_comprehensive() {
  echo "1/3 🔨 Generating calibre-test-comprehensive.db..."
  
  local OUTPUT_DB="$FIXTURE_DIR/calibre-test-comprehensive.db"
  local TEMP_DB="/tmp/calibre-comprehensive-temp.db"
  
  rm -f "$OUTPUT_DB" "$TEMP_DB"
  
  # Create schema
  create_calibre_schema "$TEMP_DB"
  
  # Select diverse books from source
  sqlite3 "$SOURCE_DB" > /tmp/selected_book_ids.txt <<'EOF'
.mode list
-- Books with rating 2 (1 star)
SELECT b.id FROM books b
JOIN books_ratings_link brl ON b.id = brl.book
JOIN ratings r ON brl.rating = r.id
WHERE r.rating = 2 LIMIT 2;

-- Books with rating 4 (2 stars)
SELECT b.id FROM books b
JOIN books_ratings_link brl ON b.id = brl.book
JOIN ratings r ON brl.rating = r.id
WHERE r.rating = 4 LIMIT 2;

-- Books with rating 6 (3 stars)
SELECT b.id FROM books b
JOIN books_ratings_link brl ON b.id = brl.book
JOIN ratings r ON brl.rating = r.id
WHERE r.rating = 6 LIMIT 2;

-- Books with rating 8 (4 stars)
SELECT b.id FROM books b
JOIN books_ratings_link brl ON b.id = brl.book
JOIN ratings r ON brl.rating = r.id
WHERE r.rating = 8 LIMIT 2;

-- Books with rating 10 (5 stars)
SELECT b.id FROM books b
JOIN books_ratings_link brl ON b.id = brl.book
JOIN ratings r ON brl.rating = r.id
WHERE r.rating = 10 LIMIT 2;

-- Multi-author books
SELECT book FROM books_authors_link
GROUP BY book HAVING COUNT(*) >= 2
ORDER BY COUNT(*) DESC LIMIT 5;

-- Books in series
SELECT b.id FROM books b
JOIN books_series_link bsl ON b.id = bsl.book
ORDER BY bsl.series, b.series_index LIMIT 10;

-- Books with many tags
SELECT b.id FROM books b
JOIN books_tags_link btl ON b.id = btl.book
GROUP BY b.id ORDER BY COUNT(*) DESC LIMIT 5;

-- Books with no metadata
SELECT b.id FROM books b
WHERE b.id NOT IN (SELECT book FROM books_ratings_link)
  AND b.id NOT IN (SELECT book FROM books_series_link)
  AND b.id NOT IN (SELECT book FROM books_tags_link)
LIMIT 5;

-- Books with long titles
SELECT id FROM books ORDER BY LENGTH(title) DESC LIMIT 3;

-- Random books for remainder
SELECT id FROM books ORDER BY RANDOM() LIMIT 15;
EOF

  BOOK_IDS=$(cat /tmp/selected_book_ids.txt | sort -u | head -50 | tr '\n' ',' | sed 's/,$//')
  
  # Copy data
  sqlite3 "$SOURCE_DB" <<EOF
ATTACH DATABASE '$TEMP_DB' AS target;

INSERT INTO target.books (id, title, sort, timestamp, pubdate, series_index, author_sort, isbn, lccn, path, flags, uuid, has_cover, last_modified)
SELECT id, title, sort, timestamp, pubdate, series_index, author_sort, isbn, lccn, path, flags, uuid, has_cover, last_modified
FROM books WHERE id IN ($BOOK_IDS) ORDER BY id;

INSERT INTO target.authors (id, name, sort, link)
SELECT DISTINCT a.id, a.name, a.sort, a.link FROM authors a
JOIN books_authors_link bal ON a.id = bal.author WHERE bal.book IN ($BOOK_IDS);

INSERT INTO target.publishers (id, name, sort, link)
SELECT DISTINCT p.id, p.name, p.sort, p.link FROM publishers p
JOIN books_publishers_link bpl ON p.id = bpl.publisher WHERE bpl.book IN ($BOOK_IDS);

INSERT INTO target.series (id, name, sort, link)
SELECT DISTINCT s.id, s.name, s.sort, s.link FROM series s
JOIN books_series_link bsl ON s.id = bsl.series WHERE bsl.book IN ($BOOK_IDS);

INSERT INTO target.ratings (id, rating, link)
SELECT DISTINCT r.id, r.rating, r.link FROM ratings r
JOIN books_ratings_link brl ON r.id = brl.rating WHERE brl.book IN ($BOOK_IDS);

INSERT INTO target.tags (id, name, link)
SELECT DISTINCT t.id, t.name, t.link FROM tags t
JOIN books_tags_link btl ON t.id = btl.tag WHERE btl.book IN ($BOOK_IDS);

INSERT INTO target.books_authors_link (id, book, author)
SELECT id, book, author FROM books_authors_link WHERE book IN ($BOOK_IDS);

INSERT INTO target.books_publishers_link (id, book, publisher)
SELECT id, book, publisher FROM books_publishers_link WHERE book IN ($BOOK_IDS);

INSERT INTO target.books_ratings_link (id, book, rating)
SELECT id, book, rating FROM books_ratings_link WHERE book IN ($BOOK_IDS);

INSERT INTO target.books_series_link (id, book, series)
SELECT id, book, series FROM books_series_link WHERE book IN ($BOOK_IDS);

INSERT INTO target.books_tags_link (id, book, tag)
SELECT id, book, tag FROM books_tags_link WHERE book IN ($BOOK_IDS);

INSERT INTO target.comments (id, book, text)
SELECT id, book, text FROM comments WHERE book IN ($BOOK_IDS);

INSERT INTO target.identifiers (id, book, type, val)
SELECT id, book, type, val FROM identifiers WHERE book IN ($BOOK_IDS);

INSERT INTO target.data (id, book, format, uncompressed_size, name)
SELECT id, book, format, uncompressed_size, name FROM data WHERE book IN ($BOOK_IDS);

DETACH DATABASE target;
EOF

  mv "$TEMP_DB" "$OUTPUT_DB"
  rm -f /tmp/selected_book_ids.txt
  
  echo "  ✅ Generated with $(sqlite3 "$OUTPUT_DB" "SELECT COUNT(*) FROM books") books"
}

#==============================================================================
# FIXTURE 2: Minimal (same books, modified schema)
#==============================================================================
generate_minimal() {
  echo ""
  echo "2/3 🔨 Generating calibre-test-minimal.db..."
  
  local SOURCE_FIXTURE="$FIXTURE_DIR/calibre-test-comprehensive.db"
  local OUTPUT_DB="$FIXTURE_DIR/calibre-test-minimal.db"
  
  if [ ! -f "$SOURCE_FIXTURE" ]; then
    echo "  ❌ Error: Comprehensive fixture not found"
    return 1
  fi
  
  rm -f "$OUTPUT_DB"
  cp "$SOURCE_FIXTURE" "$OUTPUT_DB"
  
  # Remove optional columns
  sqlite3 "$OUTPUT_DB" <<'EOF'
ALTER TABLE books RENAME TO books_backup;

CREATE TABLE books ( 
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL DEFAULT 'Unknown' COLLATE NOCASE,
  sort TEXT COLLATE NOCASE,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  pubdate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  series_index REAL NOT NULL DEFAULT 1.0,
  author_sort TEXT COLLATE NOCASE,
  path TEXT NOT NULL DEFAULT "",
  flags INTEGER NOT NULL DEFAULT 1,
  uuid TEXT,
  has_cover BOOL DEFAULT 0,
  last_modified TIMESTAMP NOT NULL DEFAULT "2000-01-01 00:00:00+00:00"
);

INSERT INTO books (id, title, sort, timestamp, pubdate, series_index, author_sort, path, flags, uuid, has_cover, last_modified)
SELECT id, title, sort, timestamp, pubdate, series_index, author_sort, path, flags, uuid, has_cover, last_modified
FROM books_backup;

DROP TABLE books_backup;
VACUUM;
EOF

  echo "  ✅ Generated with $(sqlite3 "$OUTPUT_DB" "PRAGMA table_info(books)" | wc -l) columns (isbn/lccn removed)"
}

#==============================================================================
# FIXTURE 3: Series-Heavy (complete series for thorough testing)
#==============================================================================
generate_series_heavy() {
  echo ""
  echo "3/3 🔨 Generating calibre-test-series-heavy.db..."
  
  local OUTPUT_DB="$FIXTURE_DIR/calibre-test-series-heavy.db"
  local TEMP_DB="/tmp/calibre-series-temp.db"
  
  rm -f "$OUTPUT_DB" "$TEMP_DB"
  
  # Create schema (minimal - only tables needed for series testing)
  sqlite3 "$TEMP_DB" <<'EOF'
CREATE TABLE authors ( 
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL COLLATE NOCASE,
  sort TEXT COLLATE NOCASE,
  link TEXT NOT NULL DEFAULT "",
  UNIQUE(name)
);

CREATE TABLE books ( 
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL DEFAULT 'Unknown' COLLATE NOCASE,
  sort TEXT COLLATE NOCASE,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  pubdate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  series_index REAL NOT NULL DEFAULT 1.0,
  author_sort TEXT COLLATE NOCASE,
  isbn TEXT DEFAULT "" COLLATE NOCASE,
  lccn TEXT DEFAULT "" COLLATE NOCASE,
  path TEXT NOT NULL DEFAULT "",
  flags INTEGER NOT NULL DEFAULT 1,
  uuid TEXT,
  has_cover BOOL DEFAULT 0,
  last_modified TIMESTAMP NOT NULL DEFAULT "2000-01-01 00:00:00+00:00"
);

CREATE TABLE books_authors_link ( 
  id INTEGER PRIMARY KEY,
  book INTEGER NOT NULL,
  author INTEGER NOT NULL,
  UNIQUE(book, author)
);

CREATE TABLE books_series_link ( 
  id INTEGER PRIMARY KEY,
  book INTEGER NOT NULL,
  series INTEGER NOT NULL,
  UNIQUE(book)
);

CREATE TABLE books_tags_link ( 
  id INTEGER PRIMARY KEY,
  book INTEGER NOT NULL,
  tag INTEGER NOT NULL,
  UNIQUE(book, tag)
);

CREATE TABLE series ( 
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL COLLATE NOCASE,
  sort TEXT COLLATE NOCASE, 
  link TEXT NOT NULL DEFAULT '',
  UNIQUE (name)
);

CREATE TABLE tags ( 
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL COLLATE NOCASE, 
  link TEXT NOT NULL DEFAULT '',
  UNIQUE (name)
);
EOF

  # Select complete series
  sqlite3 "$SOURCE_DB" > /tmp/series_book_ids.txt <<'EOF'
.mode list
SELECT b.id FROM books b
JOIN books_series_link bsl ON b.id = bsl.book
JOIN series s ON bsl.series = s.id
WHERE s.name = 'A Court of Thorns and Roses'
ORDER BY b.series_index;

SELECT b.id FROM books b
JOIN books_series_link bsl ON b.id = bsl.book
JOIN series s ON bsl.series = s.id
WHERE s.name = 'A Series of Unfortunate Events'
ORDER BY b.series_index LIMIT 13;

SELECT b.id FROM books b
JOIN books_series_link bsl ON b.id = bsl.book
JOIN series s ON bsl.series = s.id
WHERE s.name = 'Foundation'
ORDER BY b.series_index LIMIT 10;
EOF

  BOOK_IDS=$(cat /tmp/series_book_ids.txt | sort -u | tr '\n' ',' | sed 's/,$//')
  
  # Copy data
  sqlite3 "$SOURCE_DB" <<EOF
ATTACH DATABASE '$TEMP_DB' AS target;

INSERT INTO target.books (id, title, sort, timestamp, pubdate, series_index, author_sort, isbn, lccn, path, flags, uuid, has_cover, last_modified)
SELECT id, title, sort, timestamp, pubdate, series_index, author_sort, isbn, lccn, path, flags, uuid, has_cover, last_modified
FROM books WHERE id IN ($BOOK_IDS) ORDER BY id;

INSERT INTO target.authors (id, name, sort, link)
SELECT DISTINCT a.id, a.name, a.sort, a.link FROM authors a
JOIN books_authors_link bal ON a.id = bal.author WHERE bal.book IN ($BOOK_IDS);

INSERT INTO target.series (id, name, sort, link)
SELECT DISTINCT s.id, s.name, s.sort, s.link FROM series s
JOIN books_series_link bsl ON s.id = bsl.series WHERE bsl.book IN ($BOOK_IDS);

INSERT INTO target.tags (id, name, link)
SELECT DISTINCT t.id, t.name, t.link FROM tags t
JOIN books_tags_link btl ON t.id = btl.tag WHERE btl.book IN ($BOOK_IDS);

INSERT INTO target.books_authors_link (id, book, author)
SELECT id, book, author FROM books_authors_link WHERE book IN ($BOOK_IDS);

INSERT INTO target.books_series_link (id, book, series)
SELECT id, book, series FROM books_series_link WHERE book IN ($BOOK_IDS);

INSERT INTO target.books_tags_link (id, book, tag)
SELECT id, book, tag FROM books_tags_link WHERE book IN ($BOOK_IDS);

DETACH DATABASE target;
EOF

  mv "$TEMP_DB" "$OUTPUT_DB"
  rm -f /tmp/series_book_ids.txt
  
  echo "  ✅ Generated with $(sqlite3 "$OUTPUT_DB" "SELECT COUNT(*) FROM books") books in $(sqlite3 "$OUTPUT_DB" "SELECT COUNT(*) FROM series") series"
}

#==============================================================================
# MAIN EXECUTION
#==============================================================================

generate_comprehensive
generate_minimal
generate_series_heavy

echo ""
echo "✅ All fixtures generated successfully!"
echo ""
echo "📊 Fixture Summary:"
ls -lh "$FIXTURE_DIR"/*.db | awk '{print "   " $9 ": " $5}'
echo ""
echo "📖 See __tests__/fixtures/CALIBRE_TEST_DATA.md for detailed documentation"
