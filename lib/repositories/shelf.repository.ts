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

export interface ShelfWithBookCount extends Shelf {
  bookCount: number;
}

export interface ShelfWithBooks extends Shelf {
  books: Book[];
}

export interface BookWithShelfInfo extends Book {
  sortOrder: number;
  addedAt: Date;
}

export type ShelfOrderBy = "sortOrder" | "title" | "dateAdded" | "recentlyAdded";

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
   * Find a shelf by ID with all its books
   */
  async findByIdWithBooks(
    shelfId: number,
    orderBy: ShelfOrderBy = "sortOrder"
  ): Promise<ShelfWithBooks | null> {
    const shelf = await this.findById(shelfId);
    if (!shelf) {
      return null;
    }

    const booksOnShelf = await this.getBooksOnShelf(shelfId, orderBy);

    return {
      ...shelf,
      books: booksOnShelf,
    };
  }

  /**
   * Get all books on a specific shelf with ordering options
   */
  async getBooksOnShelf(
    shelfId: number,
    orderBy: ShelfOrderBy = "sortOrder"
  ): Promise<Book[]> {
    let orderClause;

    switch (orderBy) {
      case "title":
        orderClause = asc(books.title);
        break;
      case "dateAdded":
        orderClause = asc(bookShelves.addedAt);
        break;
      case "recentlyAdded":
        orderClause = desc(bookShelves.addedAt);
        break;
      case "sortOrder":
      default:
        orderClause = asc(bookShelves.sortOrder);
        break;
    }

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
      })
      .from(bookShelves)
      .innerJoin(books, eq(bookShelves.bookId, books.id))
      .where(eq(bookShelves.shelfId, shelfId))
      .orderBy(orderClause)
      .all();

    return result as Book[];
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
   */
  async removeBookFromShelf(shelfId: number, bookId: number): Promise<boolean> {
    const result = await this.getDatabase()
      .delete(bookShelves)
      .where(and(eq(bookShelves.shelfId, shelfId), eq(bookShelves.bookId, bookId)))
      .run();

    return (result as any).changes > 0;
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
