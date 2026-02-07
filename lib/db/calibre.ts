import { createDatabase } from "./factory";
import { getLogger } from "@/lib/logger";

// Type definition for SQLite database interface
type SQLiteDatabase = any;

// Removed module-level logger call to prevent pino from loading during instrumentation phase
// The warning is now logged when getCalibreDB() is first called (see below)

let dbInstance: ReturnType<typeof createDatabase> | null = null;
let hasLoggedWarning = false;

export function getCalibreDB() {
  // Read CALIBRE_DB_PATH lazily to allow tests to set it before first call
  const CALIBRE_DB_PATH = process.env.CALIBRE_DB_PATH || "";
  
  if (!CALIBRE_DB_PATH) {
    // Log warning once when function is actually called (not at module load time)
    if (!hasLoggedWarning) {
      getLogger().warn("CALIBRE_DB_PATH not set. Calibre integration will not work.");
      hasLoggedWarning = true;
    }
    throw new Error("CALIBRE_DB_PATH environment variable is not set");
  }

  if (!dbInstance) {
    try {
      // Create read-only Calibre database connection using factory
      dbInstance = createDatabase({
        path: CALIBRE_DB_PATH,
        readonly: true,
        foreignKeys: false, // Calibre DB manages its own schema
        wal: false, // Don't modify journal mode on read-only DB
      });
      getLogger().debug('Calibre DB: Using better-sqlite3');
    } catch (error) {
      throw new Error(`Failed to connect to Calibre database: ${error}`);
    }
  }

  return dbInstance.sqlite;
}

/**
 * Reset the Calibre DB singleton instance (for testing purposes)
 * @internal
 */
export function resetCalibreDB() {
  if (dbInstance) {
    try {
      dbInstance.sqlite.close();
    } catch (e) {
      // Ignore close errors
    }
    dbInstance = null;
  }
  hasLoggedWarning = false;
}

export interface CalibreBook {
  id: number;
  title: string;
  authors: string;
  isbn: string | null;
  publisher: string | null;
  pubdate: string | null;
  series: string | null;
  series_index: number | null;
  timestamp: string;
  path: string;
  has_cover: number;
  description: string | null;
  rating: number | null; // 1-5 stars (converted from Calibre's 0-10 scale)
}

export interface PaginationOptions {
  limit?: number;
  offset?: number;
}

/**
 * Get total count of books in Calibre library
 */
export function getBooksCount(): number {
  const db = getCalibreDB();
  const result = db.prepare("SELECT COUNT(*) as count FROM books").get() as { count: number };
  return result.count;
}

/**
 * Get all books from Calibre library with optional pagination
 * @param options - Pagination options (limit/offset)
 * @returns Array of CalibreBook objects
 */
export function getAllBooks(options?: PaginationOptions): CalibreBook[] {
  const db = getCalibreDB();

  // First, check what columns exist in the books table
  const columns = db.prepare("PRAGMA table_info(books)").all() as Array<{ name: string }>;
  const columnNames = columns.map(c => c.name);

  const hasPublisher = columnNames.includes('publisher');

  // Check for direct series column (test DB schema)
  const hasSeriesColumn = columnNames.includes('series');

  // Check for series link table (production Calibre schema)
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>;
  const tableNames = tables.map(t => t.name);
  const hasSeriesLinkTable = tableNames.includes('books_series_link');

  const hasSeries = hasSeriesColumn || hasSeriesLinkTable;

  const query = `
    SELECT
      b.id,
      b.title,
      b.timestamp,
      b.pubdate,
      ${hasSeries ? 'b.series_index,' : 'NULL as series_index,'}
      b.path,
      b.has_cover,
      GROUP_CONCAT(DISTINCT a.name) as authors,
      ${hasPublisher ? 'p.name' : 'NULL'} as publisher,
      ${hasSeries ? 's.name' : 'NULL'} as series,
      GROUP_CONCAT(DISTINCT i.val) as isbn,
      c.text as description,
      r.rating as rating
    FROM books b
    LEFT JOIN books_authors_link bal ON b.id = bal.book
    LEFT JOIN authors a ON bal.author = a.id
    ${hasPublisher ? 'LEFT JOIN publishers p ON b.publisher = p.id' : ''}
    ${hasSeriesColumn
      ? 'LEFT JOIN series s ON b.series = s.id'
      : hasSeriesLinkTable
        ? 'LEFT JOIN books_series_link bsl ON b.id = bsl.book LEFT JOIN series s ON bsl.series = s.id'
        : ''
    }
    LEFT JOIN identifiers i ON b.id = i.book AND i.type = 'isbn'
    LEFT JOIN comments c ON b.id = c.book
    LEFT JOIN books_ratings_link brl ON b.id = brl.book
    LEFT JOIN ratings r ON brl.rating = r.id
    GROUP BY b.id
    ORDER BY b.title COLLATE NOCASE
    ${options?.limit ? `LIMIT ${options.limit}` : ''}
    ${options?.offset && options.limit ? `OFFSET ${options.offset}` : ''}
  `;

  const books = db.prepare(query).all() as CalibreBook[];
  
  // Convert ratings from 0-10 scale to 1-5 stars
  return books.map(book => ({
    ...book,
    rating: book.rating ? book.rating / 2 : null
  }));
}

export function getBookById(id: number): CalibreBook | undefined {
  const db = getCalibreDB();

  // Check what columns exist
  const columns = db.prepare("PRAGMA table_info(books)").all() as Array<{ name: string }>;
  const columnNames = columns.map(c => c.name);

  const hasPublisher = columnNames.includes('publisher');

  // Check for direct series column (test DB schema)
  const hasSeriesColumn = columnNames.includes('series');

  // Check for series link table (production Calibre schema)
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>;
  const tableNames = tables.map(t => t.name);
  const hasSeriesLinkTable = tableNames.includes('books_series_link');

  const hasSeries = hasSeriesColumn || hasSeriesLinkTable;

  const query = `
    SELECT
      b.id,
      b.title,
      b.timestamp,
      b.pubdate,
      ${hasSeries ? 'b.series_index,' : 'NULL as series_index,'}
      b.path,
      b.has_cover,
      GROUP_CONCAT(DISTINCT a.name) as authors,
      ${hasPublisher ? 'p.name' : 'NULL'} as publisher,
      ${hasSeries ? 's.name' : 'NULL'} as series,
      GROUP_CONCAT(DISTINCT i.val) as isbn,
      c.text as description,
      r.rating as rating
    FROM books b
    LEFT JOIN books_authors_link bal ON b.id = bal.book
    LEFT JOIN authors a ON bal.author = a.id
    ${hasPublisher ? 'LEFT JOIN publishers p ON b.publisher = p.id' : ''}
    ${hasSeriesColumn
      ? 'LEFT JOIN series s ON b.series = s.id'
      : hasSeriesLinkTable
        ? 'LEFT JOIN books_series_link bsl ON b.id = bsl.book LEFT JOIN series s ON bsl.series = s.id'
        : ''
    }
    LEFT JOIN identifiers i ON b.id = i.book AND i.type = 'isbn'
    LEFT JOIN comments c ON b.id = c.book
    LEFT JOIN books_ratings_link brl ON b.id = brl.book
    LEFT JOIN ratings r ON brl.rating = r.id
    WHERE b.id = ?
    GROUP BY b.id
  `;

  const book = db.prepare(query).get(id) as CalibreBook | undefined;
  
  if (!book) {
    return undefined;
  }
  
  // Convert rating from 0-10 scale to 1-5 stars
  return {
    ...book,
    rating: book.rating ? book.rating / 2 : null
  };
}

export function searchBooks(query: string): CalibreBook[] {
  const db = getCalibreDB();

  // Check what columns exist
  const columns = db.prepare("PRAGMA table_info(books)").all() as Array<{ name: string }>;
  const columnNames = columns.map(c => c.name);

  const hasPublisher = columnNames.includes('publisher');

  // Check for direct series column (test DB schema)
  const hasSeriesColumn = columnNames.includes('series');

  // Check for series link table (production Calibre schema)
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>;
  const tableNames = tables.map(t => t.name);
  const hasSeriesLinkTable = tableNames.includes('books_series_link');

  const hasSeries = hasSeriesColumn || hasSeriesLinkTable;

  const searchQuery = `
    SELECT
      b.id,
      b.title,
      b.timestamp,
      b.pubdate,
      ${hasSeries ? 'b.series_index,' : 'NULL as series_index,'}
      b.path,
      b.has_cover,
      GROUP_CONCAT(DISTINCT a.name) as authors,
      ${hasPublisher ? 'p.name' : 'NULL'} as publisher,
      ${hasSeries ? 's.name' : 'NULL'} as series,
      GROUP_CONCAT(DISTINCT i.val) as isbn,
      c.text as description,
      r.rating as rating
    FROM books b
    LEFT JOIN books_authors_link bal ON b.id = bal.book
    LEFT JOIN authors a ON bal.author = a.id
    ${hasPublisher ? 'LEFT JOIN publishers p ON b.publisher = p.id' : ''}
    ${hasSeriesColumn
      ? 'LEFT JOIN series s ON b.series = s.id'
      : hasSeriesLinkTable
        ? 'LEFT JOIN books_series_link bsl ON b.id = bsl.book LEFT JOIN series s ON bsl.series = s.id'
        : ''
    }
    LEFT JOIN identifiers i ON b.id = i.book AND i.type = 'isbn'
    LEFT JOIN comments c ON b.id = c.book
    LEFT JOIN books_ratings_link brl ON b.id = brl.book
    LEFT JOIN ratings r ON brl.rating = r.id
    WHERE b.title LIKE ? OR a.name LIKE ?
    GROUP BY b.id
    ORDER BY b.title
  `;

  const searchTerm = `%${query}%`;
  const books = db.prepare(searchQuery).all(searchTerm, searchTerm) as CalibreBook[];
  
  // Convert ratings from 0-10 scale to 1-5 stars
  return books.map(book => ({
    ...book,
    rating: book.rating ? book.rating / 2 : null
  }));
}

export function getBookTags(bookId: number): string[] {
  const db = getCalibreDB();

  const query = `
    SELECT t.name
    FROM tags t
    JOIN books_tags_link btl ON t.id = btl.tag
    WHERE btl.book = ?
    ORDER BY t.name
  `;

  const tags = db.prepare(query).all(bookId) as { name: string }[];
  return tags.map((tag) => tag.name);
}

/**
 * Get all tags for all books (or specific book IDs) in a single query
 * Returns a Map of book ID to array of tag names
 * 
 * This is much more efficient than calling getBookTags() for each book individually.
 * For a library with 150k books, this reduces 150k queries to 1 query.
 * 
 * @param bookIds - Optional array of book IDs to fetch tags for. If not provided, fetches tags for all books.
 */
export function getAllBookTags(bookIds?: number[]): Map<number, string[]> {
  const db = getCalibreDB();

  let query: string;
  let results: Array<{ bookId: number; tagName: string }>;

  if (bookIds && bookIds.length > 0) {
    // Fetch tags only for specified book IDs
    const placeholders = bookIds.map(() => '?').join(',');
    query = `
      SELECT btl.book as bookId, t.name as tagName
      FROM books_tags_link btl
      JOIN tags t ON btl.tag = t.id
      WHERE btl.book IN (${placeholders})
      ORDER BY btl.book, t.name
    `;
    results = db.prepare(query).all(...bookIds) as Array<{ bookId: number; tagName: string }>;
  } else if (bookIds && bookIds.length === 0) {
    // Empty array - return empty map
    return new Map<number, string[]>();
  } else {
    // Fetch all tags for all books
    query = `
      SELECT btl.book as bookId, t.name as tagName
      FROM books_tags_link btl
      JOIN tags t ON btl.tag = t.id
      ORDER BY btl.book, t.name
    `;
    results = db.prepare(query).all() as Array<{ bookId: number; tagName: string }>;
  }
  
  // Build map: bookId -> [tag1, tag2, ...]
  const tagsMap = new Map<number, string[]>();
  
  for (const row of results) {
    const tags = tagsMap.get(row.bookId) || [];
    tags.push(row.tagName);
    tagsMap.set(row.bookId, tags);
  }
  
  return tagsMap;
}

/**
 * Format information from Calibre data table
 */
export interface CalibreBookFormat {
  format: string;    // 'EPUB', 'PDF', 'MOBI', etc.
  name: string;      // filename without extension
  size: number;      // uncompressed_size in bytes
}

/**
 * Get all available formats for a single book
 * @param bookId - Calibre book ID
 * @returns Array of format objects, sorted by priority (EPUB first)
 */
export function getBookFormats(bookId: number): CalibreBookFormat[] {
  const db = getCalibreDB();

  const query = `
    SELECT
      format,
      name,
      uncompressed_size as size
    FROM data
    WHERE book = ?
    ORDER BY
      CASE format
        WHEN 'EPUB' THEN 1
        WHEN 'KEPUB' THEN 2
        WHEN 'PDF' THEN 3
        WHEN 'MOBI' THEN 4
        WHEN 'AZW3' THEN 5
        WHEN 'AZW' THEN 6
        ELSE 99
      END
  `;

  return db.prepare(query).all(bookId) as CalibreBookFormat[];
}

/**
 * Get formats for multiple books in a single query (bulk optimization)
 * Returns a Map of book ID to array of formats
 *
 * This is much more efficient than calling getBookFormats() for each book individually.
 * Reduces N queries to 1 query.
 *
 * @param bookIds - Array of Calibre book IDs to fetch formats for
 * @returns Map of book ID to array of formats
 */
export function getAllBookFormats(bookIds: number[]): Map<number, CalibreBookFormat[]> {
  const db = getCalibreDB();

  if (!bookIds || bookIds.length === 0) {
    return new Map<number, CalibreBookFormat[]>();
  }

  // Fetch formats for all specified book IDs
  const placeholders = bookIds.map(() => '?').join(',');
  const query = `
    SELECT
      book as bookId,
      format,
      name,
      uncompressed_size as size
    FROM data
    WHERE book IN (${placeholders})
    ORDER BY
      book,
      CASE format
        WHEN 'EPUB' THEN 1
        WHEN 'KEPUB' THEN 2
        WHEN 'PDF' THEN 3
        WHEN 'MOBI' THEN 4
        WHEN 'AZW3' THEN 5
        WHEN 'AZW' THEN 6
        ELSE 99
      END
  `;

  const results = db.prepare(query).all(...bookIds) as Array<{
    bookId: number;
    format: string;
    name: string;
    size: number;
  }>;

  // Build map: bookId -> [format1, format2, ...]
  const formatsMap = new Map<number, CalibreBookFormat[]>();

  for (const row of results) {
    const formats = formatsMap.get(row.bookId) || [];
    formats.push({
      format: row.format,
      name: row.name,
      size: row.size,
    });
    formatsMap.set(row.bookId, formats);
  }

  return formatsMap;
}

/**
 * Get a single book with its formats included
 * @param bookId - Calibre book ID
 * @returns CalibreBook with formats array, or undefined if not found
 */
export function getBookWithFormats(bookId: number): (CalibreBook & { formats: CalibreBookFormat[] }) | undefined {
  const book = getBookById(bookId);
  if (!book) {
    return undefined;
  }

  const formats = getBookFormats(bookId);

  return {
    ...book,
    formats,
  };
}

/**
 * Get all distinct authors with book counts
 * @returns Array of author objects with name and book count
 */
export function getAllAuthors(): Array<{ name: string; bookCount: number }> {
  const db = getCalibreDB();

  const query = `
    SELECT
      a.name,
      COUNT(DISTINCT bal.book) as bookCount
    FROM authors a
    JOIN books_authors_link bal ON a.id = bal.author
    GROUP BY a.id, a.name
    ORDER BY a.name ASC
  `;

  return db.prepare(query).all() as Array<{ name: string; bookCount: number }>;
}

/**
 * Get books by a specific author with pagination
 * @param authorName - Author name to filter by
 * @param options - Pagination options (limit/offset)
 * @returns Array of CalibreBook objects for that author
 */
export function getBooksByAuthor(authorName: string, options?: PaginationOptions): CalibreBook[] {
  const db = getCalibreDB();

  // Check schema to determine how to handle series and publisher
  const columns = db.prepare("PRAGMA table_info(books)").all() as Array<{ name: string }>;
  const columnNames = columns.map(c => c.name);
  const hasPublisherColumn = columnNames.includes('publisher');

  // Check for series_link table (production Calibre schema)
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>;
  const tableNames = tables.map(t => t.name);
  const hasSeriesLinkTable = tableNames.includes('books_series_link');

  // Build series join
  let seriesJoin = '';
  let seriesSelect = '';
  if (hasSeriesLinkTable) {
    seriesJoin = 'LEFT JOIN books_series_link bsl ON b.id = bsl.book LEFT JOIN series s ON bsl.series = s.id';
    seriesSelect = 's.name as series';
  } else {
    seriesJoin = 'LEFT JOIN series s ON b.series = s.id';
    seriesSelect = 's.name as series';
  }

  // Build publisher join
  let publisherJoin = '';
  let publisherSelect = '';
  if (hasPublisherColumn) {
    publisherJoin = 'LEFT JOIN publishers p ON b.publisher = p.id';
    publisherSelect = 'p.name as publisher';
  } else {
    publisherJoin = 'LEFT JOIN books_publishers_link bpl ON b.id = bpl.book LEFT JOIN publishers p ON bpl.publisher = p.id';
    publisherSelect = 'p.name as publisher';
  }

  const query = `
    SELECT
      b.id,
      b.title,
      b.timestamp,
      b.pubdate,
      b.path,
      b.has_cover,
      b.series_index,
      GROUP_CONCAT(DISTINCT a.name) as authors,
      GROUP_CONCAT(DISTINCT i.val) as isbn,
      ${publisherSelect},
      ${seriesSelect},
      c.text as description,
      CASE WHEN r.rating IS NOT NULL THEN CAST((r.rating / 2.0) as INTEGER) ELSE NULL END as rating
    FROM books b
    LEFT JOIN books_authors_link bal ON b.id = bal.book
    LEFT JOIN authors a ON bal.author = a.id
    LEFT JOIN identifiers i ON b.id = i.book AND i.type = 'isbn'
    LEFT JOIN comments c ON b.id = c.book
    LEFT JOIN books_ratings_link brl ON b.id = brl.book
    LEFT JOIN ratings r ON brl.rating = r.id
    ${publisherJoin}
    ${seriesJoin}
    WHERE a.name = ?
    GROUP BY b.id
    ORDER BY b.title
    ${options?.limit ? `LIMIT ${options.limit}` : ''}
    ${options?.offset ? `OFFSET ${options.offset}` : ''}
  `;

  return db.prepare(query).all(authorName) as CalibreBook[];
}

/**
 * Get all distinct series with book counts
 * @returns Array of series objects with name and book count
 */
export function getAllSeries(): Array<{ name: string; bookCount: number }> {
  const db = getCalibreDB();

  // Check for series_link table (production Calibre schema)
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>;
  const tableNames = tables.map(t => t.name);
  const hasSeriesLinkTable = tableNames.includes('books_series_link');

  let query = '';
  if (hasSeriesLinkTable) {
    query = `
      SELECT
        s.name,
        COUNT(DISTINCT bsl.book) as bookCount
      FROM series s
      JOIN books_series_link bsl ON s.id = bsl.series
      GROUP BY s.id, s.name
      ORDER BY s.name ASC
    `;
  } else {
    query = `
      SELECT
        s.name,
        COUNT(DISTINCT b.id) as bookCount
      FROM series s
      JOIN books b ON b.series = s.id
      GROUP BY s.id, s.name
      ORDER BY s.name ASC
    `;
  }

  return db.prepare(query).all() as Array<{ name: string; bookCount: number }>;
}

/**
 * Get books in a specific series with pagination
 * @param seriesName - Series name to filter by
 * @param options - Pagination options (limit/offset)
 * @returns Array of CalibreBook objects in that series, ordered by series_index
 */
export function getBooksBySeries(seriesName: string, options?: PaginationOptions): CalibreBook[] {
  const db = getCalibreDB();

  // Check schema
  const columns = db.prepare("PRAGMA table_info(books)").all() as Array<{ name: string }>;
  const columnNames = columns.map(c => c.name);
  const hasPublisherColumn = columnNames.includes('publisher');

  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>;
  const tableNames = tables.map(t => t.name);
  const hasSeriesLinkTable = tableNames.includes('books_series_link');

  // Build series join
  let seriesJoin = '';
  let seriesSelect = '';
  let seriesWhere = '';
  if (hasSeriesLinkTable) {
    seriesJoin = 'JOIN books_series_link bsl ON b.id = bsl.book JOIN series s ON bsl.series = s.id';
    seriesSelect = 's.name as series';
    seriesWhere = 's.name = ?';
  } else {
    seriesJoin = 'JOIN series s ON b.series = s.id';
    seriesSelect = 's.name as series';
    seriesWhere = 's.name = ?';
  }

  // Build publisher join
  let publisherJoin = '';
  let publisherSelect = '';
  if (hasPublisherColumn) {
    publisherJoin = 'LEFT JOIN publishers p ON b.publisher = p.id';
    publisherSelect = 'p.name as publisher';
  } else {
    publisherJoin = 'LEFT JOIN books_publishers_link bpl ON b.id = bpl.book LEFT JOIN publishers p ON bpl.publisher = p.id';
    publisherSelect = 'p.name as publisher';
  }

  const query = `
    SELECT
      b.id,
      b.title,
      b.timestamp,
      b.pubdate,
      b.path,
      b.has_cover,
      b.series_index,
      GROUP_CONCAT(DISTINCT a.name) as authors,
      GROUP_CONCAT(DISTINCT i.val) as isbn,
      ${publisherSelect},
      ${seriesSelect},
      c.text as description,
      CASE WHEN r.rating IS NOT NULL THEN CAST((r.rating / 2.0) as INTEGER) ELSE NULL END as rating
    FROM books b
    ${seriesJoin}
    LEFT JOIN books_authors_link bal ON b.id = bal.book
    LEFT JOIN authors a ON bal.author = a.id
    LEFT JOIN identifiers i ON b.id = i.book AND i.type = 'isbn'
    LEFT JOIN comments c ON b.id = c.book
    LEFT JOIN books_ratings_link brl ON b.id = brl.book
    LEFT JOIN ratings r ON brl.rating = r.id
    ${publisherJoin}
    WHERE ${seriesWhere}
    GROUP BY b.id
    ORDER BY b.series_index, b.title
    ${options?.limit ? `LIMIT ${options.limit}` : ''}
    ${options?.offset ? `OFFSET ${options.offset}` : ''}
  `;

  return db.prepare(query).all(seriesName) as CalibreBook[];
}

/**
 * Get all distinct tags with book counts from Calibre
 * @returns Array of tag objects with name and book count
 */
export function getCalibreTags(): Array<{ name: string; bookCount: number }> {
  const db = getCalibreDB();

  const query = `
    SELECT
      t.name,
      COUNT(DISTINCT btl.book) as bookCount
    FROM tags t
    JOIN books_tags_link btl ON t.id = btl.tag
    GROUP BY t.id, t.name
    ORDER BY t.name ASC
  `;

  return db.prepare(query).all() as Array<{ name: string; bookCount: number }>;
}

/**
 * Get books with a specific Calibre tag with pagination
 * @param tagName - Tag name to filter by
 * @param options - Pagination options (limit/offset)
 * @returns Array of CalibreBook objects with that tag
 */
export function getBooksByTag(tagName: string, options?: PaginationOptions): CalibreBook[] {
  const db = getCalibreDB();

  // Check schema
  const columns = db.prepare("PRAGMA table_info(books)").all() as Array<{ name: string }>;
  const columnNames = columns.map(c => c.name);
  const hasPublisherColumn = columnNames.includes('publisher');

  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>;
  const tableNames = tables.map(t => t.name);
  const hasSeriesLinkTable = tableNames.includes('books_series_link');

  // Build series join
  let seriesJoin = '';
  let seriesSelect = '';
  if (hasSeriesLinkTable) {
    seriesJoin = 'LEFT JOIN books_series_link bsl ON b.id = bsl.book LEFT JOIN series s ON bsl.series = s.id';
    seriesSelect = 's.name as series';
  } else {
    seriesJoin = 'LEFT JOIN series s ON b.series = s.id';
    seriesSelect = 's.name as series';
  }

  // Build publisher join
  let publisherJoin = '';
  let publisherSelect = '';
  if (hasPublisherColumn) {
    publisherJoin = 'LEFT JOIN publishers p ON b.publisher = p.id';
    publisherSelect = 'p.name as publisher';
  } else {
    publisherJoin = 'LEFT JOIN books_publishers_link bpl ON b.id = bpl.book LEFT JOIN publishers p ON bpl.publisher = p.id';
    publisherSelect = 'p.name as publisher';
  }

  const query = `
    SELECT
      b.id,
      b.title,
      b.timestamp,
      b.pubdate,
      b.path,
      b.has_cover,
      b.series_index,
      GROUP_CONCAT(DISTINCT a.name) as authors,
      GROUP_CONCAT(DISTINCT i.val) as isbn,
      ${publisherSelect},
      ${seriesSelect},
      c.text as description,
      CASE WHEN r.rating IS NOT NULL THEN CAST((r.rating / 2.0) as INTEGER) ELSE NULL END as rating
    FROM books b
    JOIN books_tags_link btl ON b.id = btl.book
    JOIN tags t ON btl.tag = t.id
    LEFT JOIN books_authors_link bal ON b.id = bal.book
    LEFT JOIN authors a ON bal.author = a.id
    LEFT JOIN identifiers i ON b.id = i.book AND i.type = 'isbn'
    LEFT JOIN comments c ON b.id = c.book
    LEFT JOIN books_ratings_link brl ON b.id = brl.book
    LEFT JOIN ratings r ON brl.rating = r.id
    ${publisherJoin}
    ${seriesJoin}
    WHERE t.name = ?
    GROUP BY b.id
    ORDER BY b.title
    ${options?.limit ? `LIMIT ${options.limit}` : ''}
    ${options?.offset ? `OFFSET ${options.offset}` : ''}
  `;

  return db.prepare(query).all(tagName) as CalibreBook[];
}

/**
 * Get recently added books
 * @param options - Pagination options (limit/offset)
 * @returns Array of CalibreBook objects ordered by timestamp DESC
 */
export function getRecentBooks(options?: PaginationOptions): CalibreBook[] {
  const db = getCalibreDB();

  // Check schema
  const columns = db.prepare("PRAGMA table_info(books)").all() as Array<{ name: string }>;
  const columnNames = columns.map(c => c.name);
  const hasPublisherColumn = columnNames.includes('publisher');

  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>;
  const tableNames = tables.map(t => t.name);
  const hasSeriesLinkTable = tableNames.includes('books_series_link');

  // Build series join
  let seriesJoin = '';
  let seriesSelect = '';
  if (hasSeriesLinkTable) {
    seriesJoin = 'LEFT JOIN books_series_link bsl ON b.id = bsl.book LEFT JOIN series s ON bsl.series = s.id';
    seriesSelect = 's.name as series';
  } else {
    seriesJoin = 'LEFT JOIN series s ON b.series = s.id';
    seriesSelect = 's.name as series';
  }

  // Build publisher join
  let publisherJoin = '';
  let publisherSelect = '';
  if (hasPublisherColumn) {
    publisherJoin = 'LEFT JOIN publishers p ON b.publisher = p.id';
    publisherSelect = 'p.name as publisher';
  } else {
    publisherJoin = 'LEFT JOIN books_publishers_link bpl ON b.id = bpl.book LEFT JOIN publishers p ON bpl.publisher = p.id';
    publisherSelect = 'p.name as publisher';
  }

  const query = `
    SELECT
      b.id,
      b.title,
      b.timestamp,
      b.pubdate,
      b.path,
      b.has_cover,
      b.series_index,
      GROUP_CONCAT(DISTINCT a.name) as authors,
      GROUP_CONCAT(DISTINCT i.val) as isbn,
      ${publisherSelect},
      ${seriesSelect},
      c.text as description,
      CASE WHEN r.rating IS NOT NULL THEN CAST((r.rating / 2.0) as INTEGER) ELSE NULL END as rating
    FROM books b
    LEFT JOIN books_authors_link bal ON b.id = bal.book
    LEFT JOIN authors a ON bal.author = a.id
    LEFT JOIN identifiers i ON b.id = i.book AND i.type = 'isbn'
    LEFT JOIN comments c ON b.id = c.book
    LEFT JOIN books_ratings_link brl ON b.id = brl.book
    LEFT JOIN ratings r ON brl.rating = r.id
    ${publisherJoin}
    ${seriesJoin}
    GROUP BY b.id
    ORDER BY b.timestamp DESC
    ${options?.limit ? `LIMIT ${options.limit}` : ''}
    ${options?.offset ? `OFFSET ${options.offset}` : ''}
  `;

  return db.prepare(query).all() as CalibreBook[];
}
