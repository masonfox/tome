import { eq, and, sql, inArray, desc, asc } from "drizzle-orm";
import { BaseRepository } from "./base.repository";
import {
  shelves,
  bookShelves,
  Shelf,
  NewShelf,
  BookShelf,
  NewBookShelf,
} from "@/lib/db/schema/shelves";
import { books, Book } from "@/lib/db/schema/books";
import { readingSessions } from "@/lib/db/schema/reading-sessions";

export interface ShelfWithBookCount extends Shelf {
  bookCount: number;
}

export interface ShelfWithBookCountAndCovers extends ShelfWithBookCount {
  bookCoverIds: number[];
}

export interface ShelfWithBooks extends Shelf {
  books: BookWithStatus[];
}

export interface BookWithShelfInfo extends Book {
  sortOrder: number;
  addedAt: Date;
}

export interface BookWithStatus extends Book {
  status: string | null;
  sortOrder?: number;
  addedAt?: Date;
}

export type ShelfOrderBy = "sortOrder" | "title" | "author" | "series" | "rating" | "pages" | "dateAdded";
export type ShelfSortDirection = "asc" | "desc";

export class ShelfRepository extends BaseRepository<
  Shelf,
  NewShelf,
  typeof shelves
> {
  constructor() {
    super(shelves);
  }

  /**
   * Find all shelves for a specific user (or null for single-user mode)
   */
  async findByUserId(userId: number | null = null): Promise<Shelf[]> {
    return this.getDatabase()
      .select()
      .from(shelves)
      .where(userId === null ? sql`${shelves.userId} IS NULL` : eq(shelves.userId, userId))
      .orderBy(asc(shelves.name))
      .all();
  }

  /**
   * Get all shelves with book counts
   */
  async findAllWithBookCount(userId: number | null = null): Promise<ShelfWithBookCount[]> {
    const result = await this.getDatabase()
      .select({
        id: shelves.id,
        userId: shelves.userId,
        name: shelves.name,
        description: shelves.description,
        color: shelves.color,
        icon: shelves.icon,
        createdAt: shelves.createdAt,
        updatedAt: shelves.updatedAt,
        bookCount: sql<number>`COUNT(DISTINCT ${bookShelves.bookId})`,
      })
      .from(shelves)
      .leftJoin(bookShelves, eq(shelves.id, bookShelves.shelfId))
      .where(userId === null ? sql`${shelves.userId} IS NULL` : eq(shelves.userId, userId))
      .groupBy(shelves.id)
      .orderBy(asc(shelves.name))
      .all();

    return result as ShelfWithBookCount[];
  }

  /**
   * Get all shelves with book counts and book cover IDs (up to 12 covers per shelf)
   */
  async findAllWithBookCountAndCovers(userId: number | null = null): Promise<ShelfWithBookCountAndCovers[]> {
    // First get all shelves with book counts
    const shelvesWithCounts = await this.findAllWithBookCount(userId);
    
    // For each shelf, get up to 12 book cover IDs (matches FannedBookCovers maxCovers default)
    const result: ShelfWithBookCountAndCovers[] = [];
    
    for (const shelf of shelvesWithCounts) {
      // Get up to 12 calibreIds for books on this shelf
      const booksOnShelf = await this.getDatabase()
        .select({
          calibreId: books.calibreId,
        })
        .from(bookShelves)
        .innerJoin(books, eq(bookShelves.bookId, books.id))
        .where(eq(bookShelves.shelfId, shelf.id))
        .orderBy(asc(bookShelves.sortOrder))
        .limit(12)
        .all();
      
      result.push({
        ...shelf,
        bookCoverIds: booksOnShelf.map(b => b.calibreId),
      });
    }
    
    return result;
  }

  /**
   * Find a shelf by ID with all its books
   */
  async findByIdWithBooks(
    shelfId: number,
    orderBy: ShelfOrderBy = "sortOrder",
    direction: ShelfSortDirection = "asc"
  ): Promise<ShelfWithBooks | null> {
    const shelf = await this.findById(shelfId);
    if (!shelf) {
      return null;
    }

    const booksOnShelf = await this.getBooksOnShelf(shelfId, orderBy, direction);

    return {
      ...shelf,
      books: booksOnShelf,
    };
  }

  /**
   * Get all books on a specific shelf with ordering options
   * Includes reading status from active sessions
   */
  async getBooksOnShelf(
    shelfId: number,
    orderBy: ShelfOrderBy = "sortOrder",
    direction: ShelfSortDirection = "asc"
  ): Promise<BookWithStatus[]> {
    const db = this.getDatabase();
    const sortFn = direction === "asc" ? asc : desc;

    // Build SQL order clause for all sorts
    let orderClause;

    switch (orderBy) {
      case "title":
        orderClause = sortFn(books.title);
        break;
      case "author":
        // Sort by pre-computed authorSort field for efficient last name sorting
        orderClause = direction === "asc"
          ? sql`${books.authorSort} ASC NULLS LAST`
          : sql`${books.authorSort} DESC NULLS LAST`;
        break;
      case "series":
        // Sort by series name first, then by series index
        // Books without series go to the end (NULL values)
        orderClause = direction === "asc"
          ? sql`${books.series} IS NULL, ${books.series} ASC, ${books.seriesIndex} ASC`
          : sql`${books.series} IS NULL, ${books.series} DESC, ${books.seriesIndex} DESC`;
        break;
      case "rating":
        // Books without rating go to the end (NULL values)
        orderClause = direction === "asc"
          ? sql`${books.rating} IS NULL, ${books.rating} ASC`
          : sql`${books.rating} IS NULL, ${books.rating} DESC`;
        break;
      case "pages":
        // Books without page count go to the end (NULL values)
        orderClause = direction === "asc"
          ? sql`${books.totalPages} IS NULL, ${books.totalPages} ASC`
          : sql`${books.totalPages} IS NULL, ${books.totalPages} DESC`;
        break;
      case "dateAdded":
        orderClause = sortFn(bookShelves.addedAt);
        break;
      case "sortOrder":
      default:
        orderClause = sortFn(bookShelves.sortOrder);
        break;
    }

    // Get the most recent session status for each book using a subquery
    const result = await db
      .select({
        id: books.id,
        calibreId: books.calibreId,
        title: books.title,
        authors: books.authors,
        isbn: books.isbn,
        totalPages: books.totalPages,
        addedToLibrary: books.addedToLibrary,
        lastSynced: books.lastSynced,
        publisher: books.publisher,
        pubDate: books.pubDate,
        series: books.series,
        seriesIndex: books.seriesIndex,
        tags: books.tags,
        path: books.path,
        description: books.description,
        rating: books.rating,
        orphaned: books.orphaned,
        orphanedAt: books.orphanedAt,
        createdAt: books.createdAt,
        updatedAt: books.updatedAt,
        status: sql<string | null>`(
          SELECT rs.status 
          FROM ${readingSessions} rs 
          WHERE rs.book_id = ${books.id}
          ORDER BY rs.session_number DESC
          LIMIT 1
        )`,
        sortOrder: bookShelves.sortOrder,
        addedAt: bookShelves.addedAt,
      })
      .from(bookShelves)
      .innerJoin(books, eq(bookShelves.bookId, books.id))
      .where(eq(bookShelves.shelfId, shelfId))
      .orderBy(orderClause)
      .all();

    const books_result = result as BookWithStatus[];

    return books_result;
  }

  /**
   * Get all books on a shelf with their shelf-specific metadata
   */
  async getBooksWithShelfInfo(shelfId: number): Promise<BookWithShelfInfo[]> {
    const result = await this.getDatabase()
      .select({
        id: books.id,
        calibreId: books.calibreId,
        title: books.title,
        authors: books.authors,
        isbn: books.isbn,
        totalPages: books.totalPages,
        addedToLibrary: books.addedToLibrary,
        lastSynced: books.lastSynced,
        publisher: books.publisher,
        pubDate: books.pubDate,
        series: books.series,
        seriesIndex: books.seriesIndex,
        tags: books.tags,
        path: books.path,
        description: books.description,
        rating: books.rating,
        orphaned: books.orphaned,
        orphanedAt: books.orphanedAt,
        createdAt: books.createdAt,
        updatedAt: books.updatedAt,
        sortOrder: bookShelves.sortOrder,
        addedAt: bookShelves.addedAt,
      })
      .from(bookShelves)
      .innerJoin(books, eq(bookShelves.bookId, books.id))
      .where(eq(bookShelves.shelfId, shelfId))
      .orderBy(asc(bookShelves.sortOrder))
      .all();

    return result as BookWithShelfInfo[];
  }

  /**
   * Get all shelves that contain a specific book
   */
  async getShelvesForBook(bookId: number): Promise<Shelf[]> {
    const result = await this.getDatabase()
      .select({
        id: shelves.id,
        userId: shelves.userId,
        name: shelves.name,
        description: shelves.description,
        color: shelves.color,
        icon: shelves.icon,
        createdAt: shelves.createdAt,
        updatedAt: shelves.updatedAt,
      })
      .from(bookShelves)
      .innerJoin(shelves, eq(bookShelves.shelfId, shelves.id))
      .where(eq(bookShelves.bookId, bookId))
      .orderBy(asc(shelves.name))
      .all();

    return result as Shelf[];
  }

  /**
   * Alias for getShelvesForBook - find all shelves that contain a specific book
   */
  async findShelvesByBookId(bookId: number): Promise<Shelf[]> {
    return this.getShelvesForBook(bookId);
  }

  /**
   * Add a book to a shelf
   */
  async addBookToShelf(
    shelfId: number,
    bookId: number,
    sortOrder?: number
  ): Promise<BookShelf> {
    // Get the max sort order if not provided
    let finalSortOrder = sortOrder;
    if (finalSortOrder === undefined) {
      const maxOrder = await this.getDatabase()
        .select({
          maxOrder: sql<number>`COALESCE(MAX(${bookShelves.sortOrder}), -1)`,
        })
        .from(bookShelves)
        .where(eq(bookShelves.shelfId, shelfId))
        .get();

      finalSortOrder = (maxOrder?.maxOrder ?? -1) + 1;
    }

    const result = await this.getDatabase()
      .insert(bookShelves)
      .values({
        shelfId,
        bookId,
        sortOrder: finalSortOrder,
      })
      .returning()
      .all();

    return result[0] as BookShelf;
  }

  /**
   * Remove a book from a shelf
   * Automatically reindexes remaining books to eliminate sortOrder gaps
   */
  async removeBookFromShelf(shelfId: number, bookId: number): Promise<boolean> {
    const result = await this.getDatabase()
      .delete(bookShelves)
      .where(and(eq(bookShelves.shelfId, shelfId), eq(bookShelves.bookId, bookId)))
      .run();

    const removed = (result as any).changes > 0;

    // Reindex remaining books to ensure continuous sortOrder (0, 1, 2, ...)
    if (removed) {
      await this.reindexShelfBooks(shelfId);
    }

    return removed;
  }

  /**
   * Remove multiple books from a shelf in a single transaction
   * Automatically reindexes remaining books after bulk deletion
   * Returns the count of books actually removed
   */
  async removeBooksFromShelf(shelfId: number, bookIds: number[]): Promise<number> {
    if (bookIds.length === 0) {
      return 0;
    }

    const db = this.getDatabase();
    let removedCount = 0;

    // Use a transaction for atomic bulk deletion
    db.transaction(() => {
      const result = db
        .delete(bookShelves)
        .where(and(eq(bookShelves.shelfId, shelfId), inArray(bookShelves.bookId, bookIds)))
        .run();

      removedCount = (result as any).changes;
    });

    // Reindex remaining books to ensure continuous sortOrder (0, 1, 2, ...)
    if (removedCount > 0) {
      await this.reindexShelfBooks(shelfId);
    }

    return removedCount;
  }

  /**
   * Update the sort order of a specific book on a shelf
   */
  async updateBookOrder(
    shelfId: number,
    bookId: number,
    newSortOrder: number
  ): Promise<boolean> {
    const result = await this.getDatabase()
      .update(bookShelves)
      .set({ sortOrder: newSortOrder })
      .where(and(eq(bookShelves.shelfId, shelfId), eq(bookShelves.bookId, bookId)))
      .run();

    return (result as any).changes > 0;
  }

  /**
   * Reorder all books in a shelf based on an array of book IDs
   * The array order determines the new sort order
   */
  async reorderBooks(shelfId: number, orderedBookIds: number[]): Promise<void> {
    const db = this.getDatabase();

    // Use a transaction to update all books atomically
    db.transaction(() => {
      orderedBookIds.forEach((bookId, index) => {
        db.update(bookShelves)
          .set({ sortOrder: index })
          .where(and(eq(bookShelves.shelfId, shelfId), eq(bookShelves.bookId, bookId)))
          .run();
      });
    });
  }

  /**
   * Reindex all books in a shelf to have continuous sortOrder values (0, 1, 2, ...)
   * This eliminates gaps caused by book removals and ensures proper ordering.
   * Books are reindexed based on their current sortOrder.
   */
  async reindexShelfBooks(shelfId: number): Promise<void> {
    const db = this.getDatabase();

    // Get all books on the shelf ordered by current sortOrder
    const booksOnShelf = await db
      .select({
        bookId: bookShelves.bookId,
      })
      .from(bookShelves)
      .where(eq(bookShelves.shelfId, shelfId))
      .orderBy(bookShelves.sortOrder, bookShelves.bookId)
      .all();

    // Use a transaction to update all books atomically
    db.transaction(() => {
      booksOnShelf.forEach((book, index) => {
        db.update(bookShelves)
          .set({ sortOrder: index })
          .where(and(eq(bookShelves.shelfId, shelfId), eq(bookShelves.bookId, book.bookId)))
          .run();
      });
    });
  }

  /**
   * Check if a book is on a specific shelf
   */
  async isBookOnShelf(shelfId: number, bookId: number): Promise<boolean> {
    const result = await this.getDatabase()
      .select()
      .from(bookShelves)
      .where(and(eq(bookShelves.shelfId, shelfId), eq(bookShelves.bookId, bookId)))
      .get();

    return result !== undefined;
  }

  /**
   * Get the count of books on a shelf
   */
  async getBookCount(shelfId: number): Promise<number> {
    const result = await this.getDatabase()
      .select({
        count: sql<number>`COUNT(*)`,
      })
      .from(bookShelves)
      .where(eq(bookShelves.shelfId, shelfId))
      .get();

    return result?.count ?? 0;
  }

  /**
   * Find books that are on any of the specified shelves
   */
  async findBooksByShelfIds(shelfIds: number[]): Promise<number[]> {
    if (shelfIds.length === 0) {
      return [];
    }

    const result = await this.getDatabase()
      .selectDistinct({
        bookId: bookShelves.bookId,
      })
      .from(bookShelves)
      .where(inArray(bookShelves.shelfId, shelfIds))
      .all();

    return result.map((r) => r.bookId);
  }

  /**
   * Delete all book associations when a shelf is deleted (handled by cascade, but available for manual use)
   */
  async deleteAllBooksFromShelf(shelfId: number): Promise<number> {
    const result = await this.getDatabase()
      .delete(bookShelves)
      .where(eq(bookShelves.shelfId, shelfId))
      .run();

    return (result as any).changes;
  }
}

// Export a singleton instance
export const shelfRepository = new ShelfRepository();
