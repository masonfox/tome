/**
 * Companion Migration: Populate author_sort field
 *
 * This migration populates the newly added author_sort field with computed
 * sort values based on existing authors data. It extracts the first author's
 * last name and formats it as "LastName, FirstName" following Calibre's convention.
 *
 * Companion to: drizzle/0017_add_author_sort.sql
 * See: docs/ADRs/ADR-013-COMPANION-MIGRATIONS.md
 */

import type { CompanionMigration } from "@/lib/db/companion-migrations";
import { getLogger } from "@/lib/logger";

const logger = getLogger().child({ migration: "0017_populate_author_sort" });

/**
 * Generate author sort value from authors array.
 * Follows Calibre convention: "LastName, FirstName MiddleNames"
 */
function generateAuthorSort(authors: string[]): string | null {
  if (!authors || authors.length === 0) {
    return null;
  }

  const firstAuthor = authors[0].trim();
  if (!firstAuthor) {
    return null;
  }

  const parts = firstAuthor.split(/\s+/);
  if (parts.length === 1) {
    return firstAuthor;
  }

  const lastName = parts[parts.length - 1];
  const firstAndMiddle = parts.slice(0, -1).join(" ");
  return `${lastName}, ${firstAndMiddle}`;
}

const migration: CompanionMigration = {
  name: "0017_populate_author_sort",

  // Only run if books table exists (skip for fresh databases)
  requiredTables: ["books"],

  description: "Populate author_sort field from authors JSON array",

  async execute(db) {
    logger.info("Starting author_sort population...");

    // Get all books that have authors but no author_sort yet
    const books = db.prepare(
      "SELECT id, authors FROM books WHERE authors IS NOT NULL"
    ).all() as Array<{ id: number; authors: string }>;

    logger.info({ count: books.length }, "Found books to process");

    if (books.length === 0) {
      logger.info("No books found, nothing to do");
      return;
    }

    const updateStmt = db.prepare(
      "UPDATE books SET author_sort = ? WHERE id = ?"
    );

    let processed = 0;
    let withSort = 0;
    let errors = 0;

    for (const book of books) {
      try {
        // Parse JSON authors array
        const authors = JSON.parse(book.authors) as string[];
        const authorSort = generateAuthorSort(authors);

        updateStmt.run(authorSort, book.id);

        if (authorSort) {
          withSort++;
        }

        processed++;

        // Log progress every 1000 books
        if (processed % 1000 === 0) {
          logger.info({ processed, total: books.length }, "Progress");
        }
      } catch (error) {
        logger.error({ bookId: book.id, error }, "Failed to process book");
        errors++;
        // Continue processing other books instead of aborting
      }
    }

    logger.info(
      {
        processed,
        withSort,
        withoutSort: processed - withSort,
        errors
      },
      "Author sort population complete"
    );
  }
};

export default migration;
