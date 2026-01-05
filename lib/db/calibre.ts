import { createDatabase } from "./factory";

// Type definition for SQLite database interface
// Both bun:sqlite and better-sqlite3 have compatible APIs
type SQLiteDatabase = any;

const CALIBRE_DB_PATH = process.env.CALIBRE_DB_PATH || "";

// Removed module-level logger call to prevent pino from loading during instrumentation phase
// The warning is now logged when getCalibreDB() is first called (see below)

let dbInstance: ReturnType<typeof createDatabase> | null = null;
let hasLoggedWarning = false;

export function getCalibreDB() {
  if (!CALIBRE_DB_PATH) {
    // Log warning once when function is actually called (not at module load time)
    if (!hasLoggedWarning) {
      const { getLogger } = require("../logger");
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
      const { getLogger } = require("../logger");
      getLogger().debug(`Calibre DB: Using ${dbInstance.runtime === 'bun' ? 'bun:sqlite' : 'better-sqlite3'}`);
    } catch (error) {
      throw new Error(`Failed to connect to Calibre database: ${error}`);
    }
  }

  return dbInstance.sqlite;
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

export function getAllBooks(): CalibreBook[] {
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
    ORDER BY b.title
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
