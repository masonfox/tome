import path from "path";

// Type definition for SQLite database interface
// Both bun:sqlite and better-sqlite3 have compatible APIs
type SQLiteDatabase = any;

const CALIBRE_DB_PATH = process.env.CALIBRE_DB_PATH || "";

if (!CALIBRE_DB_PATH) {
  console.warn("CALIBRE_DB_PATH not set. Calibre integration will not work.");
}

let db: SQLiteDatabase | null = null;

export function getCalibreDB() {
  if (!CALIBRE_DB_PATH) {
    throw new Error("CALIBRE_DB_PATH environment variable is not set");
  }

  if (!db) {
    try {
      // Runtime detection: Use bun:sqlite in Bun, better-sqlite3 in Node.js
      if (typeof Bun !== 'undefined') {
        // Bun runtime
        const { Database } = require('bun:sqlite');
        db = new Database(CALIBRE_DB_PATH, { readonly: true });
        console.log("Calibre DB: Using bun:sqlite (Bun runtime)");
      } else {
        // Node.js runtime
        const Database = require('better-sqlite3');
        db = new Database(CALIBRE_DB_PATH, { readonly: true });
        console.log("Calibre DB: Using better-sqlite3 (Node.js runtime)");
      }
    } catch (error) {
      throw new Error(`Failed to connect to Calibre database: ${error}`);
    }
  }

  return db;
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
}

export function getAllBooks(): CalibreBook[] {
  const db = getCalibreDB();

  // First, check what columns exist in the books table
  const columns = db.prepare("PRAGMA table_info(books)").all() as Array<{ name: string }>;
  const columnNames = columns.map(c => c.name);

  const hasPublisher = columnNames.includes('publisher');
  const hasSeries = columnNames.includes('series');

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
      c.text as description
    FROM books b
    LEFT JOIN books_authors_link bal ON b.id = bal.book
    LEFT JOIN authors a ON bal.author = a.id
    ${hasPublisher ? 'LEFT JOIN publishers p ON b.publisher = p.id' : ''}
    ${hasSeries ? 'LEFT JOIN series s ON b.series = s.id' : ''}
    LEFT JOIN identifiers i ON b.id = i.book AND i.type = 'isbn'
    LEFT JOIN comments c ON b.id = c.book
    GROUP BY b.id
    ORDER BY b.title
  `;

  return db.prepare(query).all() as CalibreBook[];
}

export function getBookById(id: number): CalibreBook | undefined {
  const db = getCalibreDB();

  // Check what columns exist
  const columns = db.prepare("PRAGMA table_info(books)").all() as Array<{ name: string }>;
  const columnNames = columns.map(c => c.name);

  const hasPublisher = columnNames.includes('publisher');
  const hasSeries = columnNames.includes('series');

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
      c.text as description
    FROM books b
    LEFT JOIN books_authors_link bal ON b.id = bal.book
    LEFT JOIN authors a ON bal.author = a.id
    ${hasPublisher ? 'LEFT JOIN publishers p ON b.publisher = p.id' : ''}
    ${hasSeries ? 'LEFT JOIN series s ON b.series = s.id' : ''}
    LEFT JOIN identifiers i ON b.id = i.book AND i.type = 'isbn'
    LEFT JOIN comments c ON b.id = c.book
    WHERE b.id = ?
    GROUP BY b.id
  `;

  return db.prepare(query).get(id) as CalibreBook | undefined;
}

export function searchBooks(query: string): CalibreBook[] {
  const db = getCalibreDB();

  // Check what columns exist
  const columns = db.prepare("PRAGMA table_info(books)").all() as Array<{ name: string }>;
  const columnNames = columns.map(c => c.name);

  const hasPublisher = columnNames.includes('publisher');
  const hasSeries = columnNames.includes('series');

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
      c.text as description
    FROM books b
    LEFT JOIN books_authors_link bal ON b.id = bal.book
    LEFT JOIN authors a ON bal.author = a.id
    ${hasPublisher ? 'LEFT JOIN publishers p ON b.publisher = p.id' : ''}
    ${hasSeries ? 'LEFT JOIN series s ON b.series = s.id' : ''}
    LEFT JOIN identifiers i ON b.id = i.book AND i.type = 'isbn'
    LEFT JOIN comments c ON b.id = c.book
    WHERE b.title LIKE ? OR a.name LIKE ?
    GROUP BY b.id
    ORDER BY b.title
  `;

  const searchTerm = `%${query}%`;
  return db.prepare(searchQuery).all(searchTerm, searchTerm) as CalibreBook[];
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
