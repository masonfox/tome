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

import { createDatabase } from "./factory";

// Type definition for SQLite database interface
type SQLiteDatabase = any;

const CALIBRE_DB_PATH = process.env.CALIBRE_DB_PATH || "";

/**
 * Get logger instance (with test-friendly fallback)
 * 
 * Returns a no-op logger in test environments to avoid global mock.module()
 * issues that leak between test files. This pattern matches getCalibreWriteDB()
 * which also has test-specific behavior.
 */
function getLoggerSafe() {
  if (process.env.NODE_ENV === 'test') {
    // Return a no-op logger for tests to avoid module mocking issues
    return {
      info: () => {},
      error: () => {},
      debug: () => {},
      warn: () => {},
    };
  }
  const { getLogger } = require("../logger");
  return getLogger();
}

if (!CALIBRE_DB_PATH) {
  getLoggerSafe().warn("CALIBRE_DB_PATH not set. Calibre write operations will not work.");
}

let writeDbInstance: ReturnType<typeof createDatabase> | null = null;

/**
 * Get write-enabled connection to Calibre database
 * ⚠️ Use with caution - only for approved operations!
 */
export function getCalibreWriteDB(): SQLiteDatabase {
  // Skip Calibre writes during tests
  if (process.env.NODE_ENV === 'test') {
    throw new Error("Calibre write operations are disabled during tests");
  }

  if (!CALIBRE_DB_PATH) {
    throw new Error("CALIBRE_DB_PATH environment variable is not set");
  }

  if (!writeDbInstance) {
    try {
      // Create write-enabled Calibre database connection using factory
      writeDbInstance = createDatabase({
        path: CALIBRE_DB_PATH,
        readonly: false,
        foreignKeys: false, // Calibre DB manages its own schema
        wal: false, // Don't modify journal mode on Calibre DB
      });
      getLoggerSafe().debug(`Calibre Write DB: Using ${writeDbInstance.runtime === 'bun' ? 'bun:sqlite' : 'better-sqlite3'} - WRITE ENABLED`);
    } catch (error) {
      throw new Error(`Failed to connect to Calibre database for writing: ${error}`);
    }
  }

  return writeDbInstance.sqlite;
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
 * @param db - (Optional) Database instance to use. Defaults to production Calibre DB. Tests can inject mock database.
 * @throws Error if rating is invalid or database operation fails
 */
export function updateCalibreRating(
  calibreId: number,
  rating: number | null,
  db: SQLiteDatabase = getCalibreWriteDB()
): void {
  
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
      getLoggerSafe().info(`[Calibre] Removed rating for book ${calibreId}`);
    } else {
      // Step 1: Get or create rating value in ratings table
      let ratingRecord = db.prepare(
        "SELECT id FROM ratings WHERE rating = ?"
      ).get(calibreRating) as { id: number } | undefined;
      
      if (!ratingRecord) {
        // Rating value doesn't exist yet, create it
        getLoggerSafe().info(`[Calibre] Creating new rating value: ${calibreRating}`);
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
        getLoggerSafe().info(`[Calibre] Updated rating for book ${calibreId} to ${rating} stars (rating_id=${ratingRecord.id})`);
      } else {
        // Create new link
        const insertStmt = db.prepare(
          "INSERT INTO books_ratings_link (book, rating) VALUES (?, ?)"
        );
        insertStmt.run(calibreId, ratingRecord.id);
        getLoggerSafe().info(`[Calibre] Created rating for book ${calibreId}: ${rating} stars (rating_id=${ratingRecord.id})`);
      }
    }
  } catch (error) {
    getLoggerSafe().error({ err: error }, `[Calibre] Failed to update rating for book ${calibreId}`);
    throw new Error(`Failed to update rating in Calibre database: ${error}`);
  }
}

/**
 * Read current rating from Calibre database
 * (For verification purposes)
 *
 * @param calibreId - The Calibre book ID
 * @param db - (Optional) Database instance to use. Defaults to production Calibre DB. Tests can inject mock database.
 * @returns Rating value (1-5 stars) or null if no rating
 */
export function readCalibreRating(
  calibreId: number,
  db: SQLiteDatabase = getCalibreWriteDB()
): number | null {
  
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
    getLoggerSafe().error({ err: error }, `[Calibre] Failed to read rating for book ${calibreId}`);
    return null;
  }
}

/**
 * Update tags for a book in Calibre database
 *
 * This function:
 * 1. Validates the tags array
 * 2. Gets or creates tag IDs in the tags table
 * 3. Clears existing links in books_tags_link table
 * 4. Creates new links for all provided tags
 *
 * @param calibreId - The Calibre book ID
 * @param tags - Array of tag names to set for the book
 * @param db - (Optional) Database instance to use. Defaults to production Calibre DB. Tests can inject mock database.
 * @throws Error if tags are invalid or database operation fails
 */
export function updateCalibreTags(
  calibreId: number,
  tags: string[],
  db: SQLiteDatabase = getCalibreWriteDB()
): void {
  
  // Validate tags
  if (!Array.isArray(tags)) {
    throw new Error("Tags must be an array");
  }
  
  // Filter out empty/invalid tags and remove duplicates (case-insensitive)
  const filteredTags = tags.filter(tag => 
    typeof tag === 'string' && tag.trim().length > 0
  ).map(tag => tag.trim());
  
  // Deduplicate case-insensitively (preserve first occurrence)
  const seen = new Set<string>();
  const validTags: string[] = [];
  for (const tag of filteredTags) {
    const lowerTag = tag.toLowerCase();
    if (!seen.has(lowerTag)) {
      seen.add(lowerTag);
      validTags.push(tag);
    }
  }
  
  try {
    // Step 1: Clear existing tag links for this book
    const deleteStmt = db.prepare("DELETE FROM books_tags_link WHERE book = ?");
    const deleteResult = deleteStmt.run(calibreId);
    getLoggerSafe().info({ calibreId, deletedLinks: deleteResult.changes }, "[Calibre] Deleted existing tag links");
    
    if (validTags.length === 0) {
      getLoggerSafe().info(`[Calibre] Removed all tags for book ${calibreId}`);
      return;
    }
    
    // Step 2: Get or create tag IDs for each tag
    const tagIds: number[] = [];
    
    for (const tagName of validTags) {
      // Check if tag exists (case-insensitive since Calibre uses COLLATE NOCASE)
      let tagRecord = db.prepare(
        "SELECT id, name FROM tags WHERE name = ? COLLATE NOCASE"
      ).get(tagName) as { id: number; name: string } | undefined;
      
      if (!tagRecord) {
        // Tag doesn't exist, create it
        getLoggerSafe().info(`[Calibre] Creating new tag: ${tagName}`);
        const insertStmt = db.prepare(
          "INSERT INTO tags (name) VALUES (?)"
        );
        const result = insertStmt.run(tagName);
        tagIds.push(Number(result.lastInsertRowid));
      } else {
        // Tag exists - update the name if case has changed
        if (tagRecord.name !== tagName) {
          getLoggerSafe().info(`[Calibre] Updating tag case: "${tagRecord.name}" -> "${tagName}"`);
          db.prepare("UPDATE tags SET name = ? WHERE id = ?").run(tagName, tagRecord.id);
        }
        tagIds.push(tagRecord.id);
      }
    }
    
    getLoggerSafe().info({ calibreId, tagIds, tagCount: tagIds.length }, "[Calibre] Got/created tag IDs");
    
    // Step 3: Create new tag links
    const insertLinkStmt = db.prepare(
      "INSERT INTO books_tags_link (book, tag) VALUES (?, ?)"
    );
    
    let linksCreated = 0;
    for (const tagId of tagIds) {
      insertLinkStmt.run(calibreId, tagId);
      linksCreated++;
    }
    
    getLoggerSafe().info({ calibreId, linksCreated, tags: validTags }, "[Calibre] Updated tags for book")
    
  } catch (error) {
    getLoggerSafe().error({ err: error }, `[Calibre] Failed to update tags for book ${calibreId}`);
    throw new Error(`Failed to update tags in Calibre database: ${error}`);
  }
}

/**
 * Batch update tags for multiple books in Calibre database
 * 
 * This function updates tags for multiple books in a single transaction,
 * providing significant performance improvements over individual updates.
 * 
 * @param updates - Array of {calibreId, tags} objects
 * @param db - (Optional) Database instance to use. Defaults to production Calibre DB.
 * @returns Number of books successfully updated
 * @throws Error if batch operation fails
 * 
 * @example
 * batchUpdateCalibreTags([
 *   { calibreId: 1, tags: ["Fantasy", "Adventure"] },
 *   { calibreId: 2, tags: ["Sci-Fi"] }
 * ]);
 */
export function batchUpdateCalibreTags(
  updates: Array<{ calibreId: number; tags: string[] }>,
  db: SQLiteDatabase = getCalibreWriteDB()
): number {
  if (!Array.isArray(updates) || updates.length === 0) {
    return 0;
  }

  try {
    let successCount = 0;

    // Process all updates - errors logged but don't stop batch
    for (const { calibreId, tags } of updates) {
      try {
        updateCalibreTags(calibreId, tags, db);
        successCount++;
      } catch (error) {
        getLoggerSafe().error(
          { err: error, calibreId },
          "[Calibre] Failed to update tags in batch operation"
        );
        // Continue with other updates
      }
    }

    getLoggerSafe().info(
      { totalUpdates: updates.length, successCount },
      "[Calibre] Batch tag update completed"
    );

    return successCount;
  } catch (error) {
    getLoggerSafe().error({ err: error }, "[Calibre] Batch tag update failed");
    throw new Error(`Batch tag update failed: ${error}`);
  }
}

/**
 * Read current tags from Calibre database
 * (For verification purposes)
 *
 * @param calibreId - The Calibre book ID
 * @param db - (Optional) Database instance to use. Defaults to production Calibre DB. Tests can inject mock database.
 * @returns Array of tag names
 */
export function readCalibreTags(
  calibreId: number,
  db: SQLiteDatabase = getCalibreWriteDB()
): string[] {
  
  try {
    const result = db.prepare(`
      SELECT t.name
      FROM books_tags_link btl
      JOIN tags t ON btl.tag = t.id
      WHERE btl.book = ?
      ORDER BY t.name
    `).all(calibreId) as { name: string }[];
    
    return result.map(r => r.name);
  } catch (error) {
    getLoggerSafe().error({ err: error }, `[Calibre] Failed to read tags for book ${calibreId}`);
    return [];
  }
}

/**
 * Close the write database connection
 * Should be called when shutting down
 */
export function closeCalibreWriteDB(): void {
  if (writeDbInstance) {
    try {
      writeDbInstance.sqlite.close();
      writeDbInstance = null;
      getLoggerSafe().info("Calibre write database connection closed");
    } catch (error) {
      getLoggerSafe().error({ err: error }, "Error closing Calibre write database");
    }
  }
}
