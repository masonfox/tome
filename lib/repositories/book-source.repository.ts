import { eq, and, inArray, sql } from "drizzle-orm";
import { BaseRepository } from "./base.repository";
import { bookSources, BookSource, NewBookSource } from "@/lib/db/schema/book-sources";
import { getLogger } from "@/lib/logger";

const logger = getLogger().child({ repository: "book-source" });

/**
 * BookSourceRepository
 * 
 * Manages many-to-many relationships between books and source providers
 * (Calibre, Audiobookshelf, etc.). Books without entries are implicitly
 * "manual" or "unconnected" books.
 * 
 * Pattern 2: Repository Pattern
 * See: .specify/memory/patterns.md
 */
export class BookSourceRepository extends BaseRepository<
  BookSource,
  NewBookSource,
  typeof bookSources
> {
  constructor() {
    super(bookSources);
  }

  protected getTable() {
    return bookSources;
  }

  /**
   * Find all sources for a specific book
   * 
   * @param bookId - Book ID
   * @returns Array of book sources (empty if manual book)
   */
  async findByBookId(bookId: number): Promise<BookSource[]> {
    return this.getDatabase()
      .select()
      .from(bookSources)
      .where(eq(bookSources.bookId, bookId))
      .all();
  }

  /**
   * Find all books from a specific provider
   * 
   * @param providerId - Provider ID (e.g., 'calibre', 'audiobookshelf')
   * @returns Array of book sources for that provider
   */
  async findByProvider(providerId: string): Promise<BookSource[]> {
    return this.getDatabase()
      .select()
      .from(bookSources)
      .where(eq(bookSources.providerId, providerId))
      .all();
  }

  /**
   * Find a specific book-provider relationship
   * 
   * @param bookId - Book ID
   * @param providerId - Provider ID
   * @returns Book source or undefined
   */
  async findByBookAndProvider(
    bookId: number,
    providerId: string
  ): Promise<BookSource | undefined> {
    return this.getDatabase()
      .select()
      .from(bookSources)
      .where(and(eq(bookSources.bookId, bookId), eq(bookSources.providerId, providerId)))
      .get();
  }

  /**
   * Find a book by provider's external ID
   * Used during sync to match provider books to local books.
   * 
   * @param providerId - Provider ID (e.g., 'calibre')
   * @param externalId - External ID from provider (e.g., Calibre's book.id)
   * @returns Book source or undefined
   */
  async findByExternalId(
    providerId: string,
    externalId: string
  ): Promise<BookSource | undefined> {
    return this.getDatabase()
      .select()
      .from(bookSources)
      .where(
        and(
          eq(bookSources.providerId, providerId),
          eq(bookSources.externalId, externalId)
        )
      )
      .get();
  }

  /**
   * Find book by Calibre ID (convenience method for migration)
   * 
   * @param calibreId - Calibre book ID
   * @returns Book source or undefined
   */
  async findByCalibreId(calibreId: number): Promise<BookSource | undefined> {
    return this.findByExternalId("calibre", String(calibreId));
  }

  /**
   * Get the primary source for a book (metadata authority)
   * 
   * @param bookId - Book ID
   * @returns Primary book source or undefined
   */
  async getPrimarySource(bookId: number): Promise<BookSource | undefined> {
    return this.getDatabase()
      .select()
      .from(bookSources)
      .where(and(eq(bookSources.bookId, bookId), eq(bookSources.isPrimary, true)))
      .get();
  }

  /**
   * Set the primary source for a book (metadata authority)
   * Only one source can be primary per book.
   * 
   * @param bookId - Book ID
   * @param providerId - Provider ID to make primary
   * @returns Updated book source
   */
  async setPrimarySource(bookId: number, providerId: string): Promise<BookSource> {
    const db = this.getDatabase();

    // Use transaction to ensure atomicity
    return db.transaction((tx) => {
      // First, unset all primary flags for this book
      tx.update(bookSources)
        .set({ isPrimary: false, updatedAt: new Date() })
        .where(eq(bookSources.bookId, bookId))
        .run();

      // Then set the new primary
      const result = tx
        .update(bookSources)
        .set({ isPrimary: true, updatedAt: new Date() })
        .where(
          and(eq(bookSources.bookId, bookId), eq(bookSources.providerId, providerId))
        )
        .returning()
        .get();

      if (!result) {
        throw new Error(
          `Book source not found: bookId=${bookId}, providerId=${providerId}`
        );
      }

      logger.info(
        { bookId, providerId },
        "Set primary source"
      );

      return result;
    });
  }

  /**
   * Upsert a book source (create or update)
   * 
   * @param data - Book source data
   * @returns Created or updated book source
   */
  async upsert(data: NewBookSource): Promise<BookSource> {
    const existing = await this.findByBookAndProvider(data.bookId, data.providerId);

    if (existing) {
      // Update existing
      return this.getDatabase()
        .update(bookSources)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(bookSources.id, existing.id))
        .returning()
        .get()!;
    } else {
      // Create new
      return this.getDatabase()
        .insert(bookSources)
        .values(data)
        .returning()
        .get()!;
    }
  }

  /**
   * Remove a book-provider relationship
   * 
   * @param bookId - Book ID
   * @param providerId - Provider ID
   * @returns True if deleted, false if not found
   */
  async removeSource(bookId: number, providerId: string): Promise<boolean> {
    const deleted = this.getDatabase()
      .delete(bookSources)
      .where(
        and(eq(bookSources.bookId, bookId), eq(bookSources.providerId, providerId))
      )
      .returning()
      .all();

    const success = deleted.length > 0;

    logger.info(
      { bookId, providerId, deleted: success },
      "Removed book source"
    );

    return success;
  }

  /**
   * Check if a book has any sources
   * Used to determine if a book is "manual" (no sources).
   * 
   * @param bookId - Book ID
   * @returns True if book has at least one source
   */
  async hasAnySources(bookId: number): Promise<boolean> {
    const count = this.getDatabase()
      .select({ count: sql<number>`COUNT(*)` })
      .from(bookSources)
      .where(eq(bookSources.bookId, bookId))
      .get();

    return (count?.count ?? 0) > 0;
  }

  /**
   * Count books by provider
   * 
   * @param providerId - Provider ID (optional, counts all if not provided)
   * @returns Count of book sources
   */
  async countByProvider(providerId?: string): Promise<number> {
    const query = this.getDatabase()
      .select({ count: sql<number>`COUNT(*)` })
      .from(bookSources);

    if (providerId) {
      query.where(eq(bookSources.providerId, providerId));
    }

    const result = query.get();
    return result?.count ?? 0;
  }

  /**
   * Get book IDs for a specific provider
   * Useful for filtering books by source.
   * 
   * @param providerId - Provider ID
   * @returns Array of book IDs
   */
  async getBookIdsByProvider(providerId: string): Promise<number[]> {
    const results = this.getDatabase()
      .select({ bookId: bookSources.bookId })
      .from(bookSources)
      .where(eq(bookSources.providerId, providerId))
      .all();

    return results.map((r) => r.bookId);
  }

  /**
   * Get book IDs for multiple providers (OR logic)
   * 
   * @param providerIds - Array of provider IDs
   * @returns Array of unique book IDs
   */
  async getBookIdsByProviders(providerIds: string[]): Promise<number[]> {
    if (providerIds.length === 0) {
      return [];
    }

    const results = this.getDatabase()
      .select({ bookId: bookSources.bookId })
      .from(bookSources)
      .where(inArray(bookSources.providerId, providerIds))
      .all();

    // Return unique book IDs
    return [...new Set(results.map((r) => r.bookId))];
  }

}

// Export singleton instance
export const bookSourceRepository = new BookSourceRepository();
