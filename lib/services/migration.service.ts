/**
 * Migration Service
 * 
 * Handles source migration workflows (e.g., manual → calibre, manual → hardcover).
 * Provides transactional updates with pessimistic locking to prevent race conditions.
 * 
 * Migration Rules:
 * - Only manual → external provider migrations allowed
 * - Cross-provider migrations (calibre ↔ hardcover) not allowed
 * - Target must have externalId (cannot migrate to manual source)
 * 
 * See: specs/003-non-calibre-books/spec.md (User Story 5, FR-016)
 */

import { getLogger } from "@/lib/logger";
import { db } from "@/lib/db/sqlite";
import { sqlite } from "@/lib/db/sqlite";
import { books } from "@/lib/db/schema/books";
import { eq } from "drizzle-orm";
import type { BookSource } from "@/lib/providers/base/IMetadataProvider";

const logger = getLogger().child({ module: "migration-service" });

/**
 * Migration validation error
 */
export class MigrationError extends Error {
  constructor(
    public readonly bookId: number,
    public readonly reason: string
  ) {
    super(`Migration failed for book ${bookId}: ${reason}`);
    this.name = "MigrationError";
  }
}

/**
 * Migration options
 */
export interface MigrateSourceOptions {
  /** Book ID to migrate */
  bookId: number;
  
  /** Target source provider */
  targetSource: BookSource;
  
  /** External ID for the target provider */
  targetExternalId: string;
  
  /** Optional: Updated metadata to apply during migration */
  metadata?: {
    title?: string;
    authors?: string[];
    isbn?: string;
    description?: string;
    publisher?: string;
    pubDate?: Date;
    totalPages?: number;
    series?: string;
    seriesIndex?: number;
    tags?: string[];
    coverImageUrl?: string;
  };
}

/**
 * Migration result
 */
export interface MigrationResult {
  bookId: number;
  oldSource: BookSource;
  newSource: BookSource;
  oldExternalId: string | null;
  newExternalId: string;
  updatedFields: string[];
}

/**
 * Migration Service
 * 
 * Orchestrates book source migrations with validation, locking, and logging.
 * 
 * @example
 * ```typescript
 * // Migrate manual book to Hardcover
 * const result = await migrationService.migrateSource({
 *   bookId: 123,
 *   targetSource: 'hardcover',
 *   targetExternalId: 'hc_abc123',
 *   metadata: { description: 'New description from Hardcover' }
 * });
 * ```
 */
export class MigrationService {

  /**
   * Validate migration request
   * 
   * @throws MigrationError if migration is invalid
   */
  private validateMigration(
    bookId: number,
    currentSource: BookSource,
    targetSource: BookSource,
    targetExternalId: string
  ): void {
    // Rule: Cannot migrate to manual source
    if (targetSource === "manual") {
      throw new MigrationError(
        bookId,
        "Cannot migrate to 'manual' source - manual books have no externalId"
      );
    }

    // Rule: Target must have externalId
    if (!targetExternalId || targetExternalId.trim() === "") {
      throw new MigrationError(
        bookId,
        "Target externalId is required for migration"
      );
    }

    // Rule: Only manual → external migrations allowed
    if (currentSource !== "manual") {
      throw new MigrationError(
        bookId,
        `Only manual → external migrations allowed (current source: ${currentSource})`
      );
    }

    // Rule: Cannot migrate to same source (string comparison)
    if (String(currentSource) === String(targetSource)) {
      throw new MigrationError(
        bookId,
        `Book is already sourced from ${targetSource}`
      );
    }

    logger.debug(
      { bookId, currentSource, targetSource, targetExternalId },
      "Migration validation passed"
    );
  }

  /**
   * Migrate book source with transactional safety
   * 
   * Uses pessimistic locking (SELECT ... FOR UPDATE) to prevent concurrent
   * modifications during migration.
   * 
   * @throws MigrationError if migration invalid or book not found
   * @throws Error if database transaction fails
   */
  async migrateSource(options: MigrateSourceOptions): Promise<MigrationResult> {
    const { bookId, targetSource, targetExternalId, metadata } = options;

    logger.info(
      { bookId, targetSource, targetExternalId },
      "Starting source migration"
    );

    return new Promise<MigrationResult>((resolve, reject) => {
      const transaction = sqlite.transaction(() => {
        // Step 1: Lock row with FOR UPDATE (pessimistic locking)
        const book = sqlite
          .prepare(
            `
            SELECT id, source, externalId, title, authors, isbn, description, 
                   publisher, pubDate, totalPages, series, seriesIndex, tags
            FROM books 
            WHERE id = ? 
            FOR UPDATE
          `
          )
          .get(bookId) as any;

        if (!book) {
          throw new MigrationError(bookId, "Book not found");
        }

        const currentSource = book.source as BookSource;
        const currentExternalId = book.externalId as string | null;

        // Step 2: Validate migration
        try {
          this.validateMigration(
            bookId,
            currentSource,
            targetSource,
            targetExternalId
          );
        } catch (error) {
          // Re-throw MigrationError to be caught by outer try/catch
          throw error;
        }

        // Step 3: Build update statement
        const updates: Record<string, any> = {
          source: targetSource,
          externalId: targetExternalId,
        };

        const updatedFields = ["source", "externalId"];

        // Apply optional metadata updates
        if (metadata) {
          if (metadata.title !== undefined) {
            updates.title = metadata.title;
            updatedFields.push("title");
          }
          if (metadata.authors !== undefined) {
            updates.authors = metadata.authors;
            updatedFields.push("authors");
          }
          if (metadata.isbn !== undefined) {
            updates.isbn = metadata.isbn;
            updatedFields.push("isbn");
          }
          if (metadata.description !== undefined) {
            updates.description = metadata.description;
            updatedFields.push("description");
          }
          if (metadata.publisher !== undefined) {
            updates.publisher = metadata.publisher;
            updatedFields.push("publisher");
          }
          if (metadata.pubDate !== undefined) {
            updates.pubDate = metadata.pubDate;
            updatedFields.push("pubDate");
          }
          if (metadata.totalPages !== undefined) {
            updates.totalPages = metadata.totalPages;
            updatedFields.push("totalPages");
          }
          if (metadata.series !== undefined) {
            updates.series = metadata.series;
            updatedFields.push("series");
          }
          if (metadata.seriesIndex !== undefined) {
            updates.seriesIndex = metadata.seriesIndex;
            updatedFields.push("seriesIndex");
          }
          if (metadata.tags !== undefined) {
            updates.tags = metadata.tags;
            updatedFields.push("tags");
          }
          if (metadata.coverImageUrl !== undefined) {
            updates.coverImageUrl = metadata.coverImageUrl;
            updatedFields.push("coverImageUrl");
          }
        }

        // Step 4: Execute update
        const setClauses = Object.keys(updates).map((key) => `${key} = ?`);
        const values = Object.values(updates);

        const updateSql = `
          UPDATE books 
          SET ${setClauses.join(", ")}, updatedAt = CURRENT_TIMESTAMP
          WHERE id = ?
        `;

        sqlite.prepare(updateSql).run(...values, bookId);

        logger.info(
          {
            bookId,
            oldSource: currentSource,
            newSource: targetSource,
            oldExternalId: currentExternalId,
            newExternalId: targetExternalId,
            updatedFields,
          },
          "Source migration completed successfully"
        );

        return {
          bookId,
          oldSource: currentSource,
          newSource: targetSource,
          oldExternalId: currentExternalId,
          newExternalId: targetExternalId,
          updatedFields,
        };
      });

      try {
        const result = transaction();
        resolve(result);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error(
          { bookId, targetSource, error: err.message },
          "Source migration failed"
        );
        reject(err);
      }
    });
  }

  /**
   * Check if migration is allowed for a book
   * 
   * Non-throwing validation check for UI pre-flight.
   * 
   * @returns Object with allowed flag and reason if not allowed
   */
  async canMigrate(
    bookId: number,
    targetSource: BookSource
  ): Promise<{ allowed: boolean; reason?: string }> {
    const book = sqlite
      .prepare("SELECT source FROM books WHERE id = ?")
      .get(bookId) as { source: BookSource } | undefined;

    if (!book) {
      return { allowed: false, reason: "Book not found" };
    }

    // Rule: Cannot migrate to manual
    if (targetSource === "manual") {
      return { allowed: false, reason: "Cannot migrate to manual source" };
    }

    // Rule: Only manual → external
    if (book.source !== "manual") {
      return {
        allowed: false,
        reason: `Only manual books can be migrated (current source: ${book.source})`,
      };
    }

    // Rule: Cannot migrate to same source (string comparison)
    if (String(book.source) === String(targetSource)) {
      return {
        allowed: false,
        reason: `Book is already sourced from ${targetSource}`,
      };
    }

    return { allowed: true };
  }

  /**
   * Get migration history for a book
   * 
   * Note: Currently we don't track migration history in a separate table.
   * This could be added in a future enhancement.
   * 
   * @returns Empty array (placeholder for future enhancement)
   */
  async getMigrationHistory(bookId: number): Promise<any[]> {
    logger.debug({ bookId }, "Migration history requested (not yet implemented)");
    return [];
  }
}

// Export singleton instance
export const migrationService = new MigrationService();
