/**
 * WRITE-ENABLED Calibre DB Connection
 * 
 * ⚠️ APPROVED WRITE OPERATIONS ONLY:
 * - Update book ratings (ratings table + books_ratings_link table)
 * 
 * All other operations MUST use read-only connection from calibre.ts.
 * 
 * VALIDATED CALIBRE SCHEMA:
 * -------------------------
 * ratings table (lookup table):
 *   - id: INTEGER PRIMARY KEY
 *   - rating: INTEGER CHECK(rating > -1 AND rating < 11), UNIQUE
 *   - link: TEXT NOT NULL DEFAULT ''
 * 
 * books_ratings_link table (junction table):
 *   - id: INTEGER PRIMARY KEY
 *   - book: INTEGER NOT NULL (FK to books.id)
 *   - rating: INTEGER NOT NULL (FK to ratings.id - NOT the rating value!)
 *   - UNIQUE(book, rating)
 * 
 * RATING SCALE:
 * ------------
 * UI Display: 1-5 stars
 * Calibre Storage: 2, 4, 6, 8, 10 (even numbers only)
 * Conversion: calibre_value = stars * 2
 */

// Type definition for SQLite database interface
type SQLiteDatabase = any;

const CALIBRE_DB_PATH = process.env.CALIBRE_DB_PATH || "";

if (!CALIBRE_DB_PATH) {
  console.warn("CALIBRE_DB_PATH not set. Calibre write operations will not work.");
}

let writeDb: SQLiteDatabase | null = null;

/**
 * Get write-enabled connection to Calibre database
 * ⚠️ Use with caution - only for approved operations!
 */
export function getCalibreWriteDB(): SQLiteDatabase {
  if (!CALIBRE_DB_PATH) {
    throw new Error("CALIBRE_DB_PATH environment variable is not set");
  }

  if (!writeDb) {
    try {
      // Runtime detection: Use bun:sqlite in Bun, better-sqlite3 in Node.js
      if (typeof Bun !== 'undefined') {
        // Bun runtime
        const { Database } = require('bun:sqlite');
        writeDb = new Database(CALIBRE_DB_PATH, { readonly: false });
        console.log("Calibre Write DB: Using bun:sqlite (Bun runtime) - WRITE ENABLED");
      } else {
        // Node.js runtime
        const Database = require('better-sqlite3');
        writeDb = new Database(CALIBRE_DB_PATH, { readonly: false });
        console.log("Calibre Write DB: Using better-sqlite3 (Node.js runtime) - WRITE ENABLED");
      }
    } catch (error) {
      throw new Error(`Failed to connect to Calibre database for writing: ${error}`);
    }
  }

  return writeDb;
}

/**
 * Update book rating in Calibre database
 * 
 * This function:
 * 1. Validates the rating (1-5 stars or null)
 * 2. Converts to Calibre scale (2, 4, 6, 8, 10)
 * 3. Gets or creates rating value in ratings table
 * 4. Updates or creates link in books_ratings_link table
 * 
 * @param calibreId - The Calibre book ID
 * @param rating - Rating value (1-5 stars) or null to remove rating
 * @throws Error if rating is invalid or database operation fails
 */
export function updateCalibreRating(calibreId: number, rating: number | null): void {
  const db = getCalibreWriteDB();
  
  // Validate rating (1-5 stars or null)
  if (rating !== null && (rating < 1 || rating > 5)) {
    throw new Error("Rating must be between 1 and 5");
  }
  
  // Convert to Calibre scale (1-5 stars → 2,4,6,8,10)
  const calibreRating = rating ? rating * 2 : null;
  
  try {
    if (calibreRating === null) {
      // Remove rating: delete from junction table
      const stmt = db.prepare("DELETE FROM books_ratings_link WHERE book = ?");
      stmt.run(calibreId);
      
      // Note: Don't delete from ratings table - it's a shared lookup table
      console.log(`[Calibre] Removed rating for book ${calibreId}`);
    } else {
      // Step 1: Get or create rating value in ratings table
      let ratingRecord = db.prepare(
        "SELECT id FROM ratings WHERE rating = ?"
      ).get(calibreRating) as { id: number } | undefined;
      
      if (!ratingRecord) {
        // Rating value doesn't exist yet, create it
        console.log(`[Calibre] Creating new rating value: ${calibreRating}`);
        const insertStmt = db.prepare(
          "INSERT INTO ratings (rating, link) VALUES (?, '')"
        );
        const result = insertStmt.run(calibreRating);
        ratingRecord = { id: Number(result.lastInsertRowid) };
      }
      
      // Step 2: Update or insert into books_ratings_link
      const existingLink = db.prepare(
        "SELECT id FROM books_ratings_link WHERE book = ?"
      ).get(calibreId) as { id: number } | undefined;
      
      if (existingLink) {
        // Update existing link to new rating ID
        const updateStmt = db.prepare(
          "UPDATE books_ratings_link SET rating = ? WHERE book = ?"
        );
        updateStmt.run(ratingRecord.id, calibreId);
        console.log(`[Calibre] Updated rating for book ${calibreId} to ${rating} stars (rating_id=${ratingRecord.id})`);
      } else {
        // Create new link
        const insertStmt = db.prepare(
          "INSERT INTO books_ratings_link (book, rating) VALUES (?, ?)"
        );
        insertStmt.run(calibreId, ratingRecord.id);
        console.log(`[Calibre] Created rating for book ${calibreId}: ${rating} stars (rating_id=${ratingRecord.id})`);
      }
    }
  } catch (error) {
    console.error(`[Calibre] Failed to update rating for book ${calibreId}:`, error);
    throw new Error(`Failed to update rating in Calibre database: ${error}`);
  }
}

/**
 * Read current rating from Calibre database
 * (For verification purposes)
 * 
 * @param calibreId - The Calibre book ID
 * @returns Rating value (1-5 stars) or null if no rating
 */
export function readCalibreRating(calibreId: number): number | null {
  const db = getCalibreWriteDB();
  
  try {
    const result = db.prepare(`
      SELECT r.rating
      FROM books_ratings_link brl
      JOIN ratings r ON brl.rating = r.id
      WHERE brl.book = ?
    `).get(calibreId) as { rating: number } | undefined;
    
    if (!result || !result.rating) {
      return null;
    }
    
    // Convert from Calibre scale (0-10) to stars (1-5)
    return result.rating / 2;
  } catch (error) {
    console.error(`[Calibre] Failed to read rating for book ${calibreId}:`, error);
    return null;
  }
}

/**
 * Close the write database connection
 * Should be called when shutting down
 */
export function closeCalibreWriteDB(): void {
  if (writeDb) {
    try {
      writeDb.close();
      writeDb = null;
      console.log("Calibre write database connection closed");
    } catch (error) {
      console.error("Error closing Calibre write database:", error);
    }
  }
}
