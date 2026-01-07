import { shelfRepository } from "@/lib/repositories/shelf.repository";
import { bookRepository } from "@/lib/repositories";
import type { Shelf, NewShelf } from "@/lib/db/schema/shelves";
import type { Book } from "@/lib/db/schema/books";
import type { BookWithStatus, ShelfOrderBy, ShelfSortDirection } from "@/lib/repositories/shelf.repository";
import { getLogger } from "@/lib/logger";
import { DATABASE_LIMITS } from "@/lib/constants";

const logger = getLogger();

export interface ShelfWithBookCount {
  id: number;
  userId: number | null;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  createdAt: Date;
  updatedAt: Date;
  bookCount: number;
}

export interface ShelfWithBookCountAndCovers extends ShelfWithBookCount {
  bookCoverIds: number[];
}

export interface ShelfWithBooks extends Shelf {
  books: BookWithStatus[];
}

export class ShelfService {
  /**
   * Get all shelves for a user
   */
  async getAllShelves(userId: number | null = null): Promise<Shelf[]> {
    logger.debug({ userId }, "Fetching all shelves");
    return shelfRepository.findByUserId(userId);
  }

  /**
   * Get all shelves with book counts
   */
  async getAllShelvesWithBookCount(userId: number | null = null): Promise<ShelfWithBookCount[]> {
    logger.debug({ userId }, "Fetching all shelves with book counts");
    return shelfRepository.findAllWithBookCount(userId);
  }

  /**
   * Get all shelves with book counts and cover IDs
   */
  async getAllShelvesWithBookCountAndCovers(userId: number | null = null): Promise<ShelfWithBookCountAndCovers[]> {
    logger.debug({ userId }, "Fetching all shelves with book counts and covers");
    return shelfRepository.findAllWithBookCountAndCovers(userId);
  }

  /**
   * Get a specific shelf with its books
   */
  async getShelfWithBooks(
    shelfId: number,
    orderBy: ShelfOrderBy = "sortOrder",
    direction: ShelfSortDirection = "asc"
  ): Promise<ShelfWithBooks | null> {
    logger.debug({ shelfId, orderBy, direction }, "Fetching shelf with books");
    return shelfRepository.findByIdWithBooks(shelfId, orderBy, direction);
  }

  /**
   * Get a shelf by ID
   */
  async getShelf(shelfId: number): Promise<Shelf | null> {
    const shelf = await shelfRepository.findById(shelfId);
    if (!shelf) {
      logger.warn({ shelfId }, "Shelf not found");
      return null;
    }
    return shelf;
  }

  /**
   * Create a new shelf
   */
  async createShelf(
    name: string,
    options?: {
      description?: string;
      color?: string;
      icon?: string;
      userId?: number | null;
    }
  ): Promise<Shelf> {
    // Validate name
    if (!name || name.trim().length === 0) {
      throw new Error("Shelf name is required");
    }

    if (name.length > DATABASE_LIMITS.SHELF_NAME_MAX_LENGTH) {
      throw new Error(
        `Shelf name must be ${DATABASE_LIMITS.SHELF_NAME_MAX_LENGTH} characters or less`
      );
    }

    // Check for duplicate name for this user
    const existingShelves = await shelfRepository.findByUserId(options?.userId ?? null);
    const duplicate = existingShelves.find(
      (s) => s.name.toLowerCase() === name.trim().toLowerCase()
    );

    if (duplicate) {
      throw new Error(`A shelf named "${name}" already exists`);
    }

    const shelfData: NewShelf = {
      name: name.trim(),
      description: options?.description ?? null,
      color: options?.color ?? null,
      icon: options?.icon ?? null,
      userId: options?.userId ?? null,
    };

    logger.info({ name, userId: options?.userId }, "Creating new shelf");
    const shelf = await shelfRepository.create(shelfData);
    logger.info({ shelfId: shelf.id, name }, "Shelf created successfully");

    return shelf;
  }

  /**
   * Update a shelf
   */
  async updateShelf(
    shelfId: number,
    updates: Partial<Pick<Shelf, "name" | "description" | "color" | "icon">>
  ): Promise<Shelf> {
    const existingShelf = await shelfRepository.findById(shelfId);
    if (!existingShelf) {
      throw new Error(`Shelf with ID ${shelfId} not found`);
    }

    // Validate name if provided
    if (updates.name !== undefined) {
      if (!updates.name || updates.name.trim().length === 0) {
        throw new Error("Shelf name cannot be empty");
      }

      if (updates.name.length > DATABASE_LIMITS.SHELF_NAME_MAX_LENGTH) {
        throw new Error(
          `Shelf name must be ${DATABASE_LIMITS.SHELF_NAME_MAX_LENGTH} characters or less`
        );
      }

      // Check for duplicate name (excluding current shelf)
      const allShelves = await shelfRepository.findByUserId(existingShelf.userId);
      const duplicate = allShelves.find(
        (s) => s.id !== shelfId && s.name.toLowerCase() === updates.name!.trim().toLowerCase()
      );

      if (duplicate) {
        throw new Error(`A shelf named "${updates.name}" already exists`);
      }

      updates.name = updates.name.trim();
    }

    logger.info({ shelfId, updates }, "Updating shelf");
    const updatedShelf = await shelfRepository.update(shelfId, updates);

    if (!updatedShelf) {
      throw new Error(`Failed to update shelf with ID ${shelfId}`);
    }

    logger.info({ shelfId }, "Shelf updated successfully");
    return updatedShelf;
  }

  /**
   * Delete a shelf (cascade deletes all book associations)
   */
  async deleteShelf(shelfId: number): Promise<boolean> {
    const shelf = await shelfRepository.findById(shelfId);
    if (!shelf) {
      throw new Error(`Shelf with ID ${shelfId} not found`);
    }

    const bookCount = await shelfRepository.getBookCount(shelfId);
    logger.info({ shelfId, name: shelf.name, bookCount }, "Deleting shelf");

    const deleted = await shelfRepository.delete(shelfId);

    if (deleted) {
      logger.info({ shelfId }, "Shelf deleted successfully");
    }

    return deleted;
  }

  /**
   * Get all shelves that contain a specific book
   */
  async getShelvesForBook(bookId: number): Promise<Shelf[]> {
    logger.debug({ bookId }, "Fetching shelves for book");
    return shelfRepository.getShelvesForBook(bookId);
  }

  /**
   * Add a book to a shelf
   */
  async addBookToShelf(shelfId: number, bookId: number, sortOrder?: number): Promise<void> {
    // Validate shelf exists
    const shelf = await shelfRepository.findById(shelfId);
    if (!shelf) {
      throw new Error(`Shelf with ID ${shelfId} not found`);
    }

    // Validate book exists
    const book = await bookRepository.findById(bookId);
    if (!book) {
      throw new Error(`Book with ID ${bookId} not found`);
    }

    // Check if book is already on shelf
    const isOnShelf = await shelfRepository.isBookOnShelf(shelfId, bookId);
    if (isOnShelf) {
      throw new Error(`Book is already on shelf "${shelf.name}"`);
    }

    logger.info({ shelfId, bookId, sortOrder }, "Adding book to shelf");
    await shelfRepository.addBookToShelf(shelfId, bookId, sortOrder);
    
    // Reindex all books to ensure continuous sortOrder
    await shelfRepository.reindexShelfBooks(shelfId);
    logger.info({ shelfId, bookId }, "Book added to shelf successfully and books reindexed");
  }

  /**
   * Remove a book from a shelf
   */
  async removeBookFromShelf(shelfId: number, bookId: number): Promise<boolean> {
    // Validate shelf exists
    const shelf = await shelfRepository.findById(shelfId);
    if (!shelf) {
      throw new Error(`Shelf with ID ${shelfId} not found`);
    }

    logger.info({ shelfId, bookId }, "Removing book from shelf");
    const removed = await shelfRepository.removeBookFromShelf(shelfId, bookId);

    if (removed) {
      // Reindex remaining books to eliminate gaps in sortOrder
      await shelfRepository.reindexShelfBooks(shelfId);
      logger.info({ shelfId, bookId }, "Book removed from shelf successfully and remaining books reindexed");
    } else {
      logger.warn({ shelfId, bookId }, "Book was not on shelf");
    }

    return removed;
  }

  /**
   * Update the sort order of a specific book on a shelf
   */
  async updateBookOrder(shelfId: number, bookId: number, sortOrder: number): Promise<void> {
    // Validate shelf exists
    const shelf = await shelfRepository.findById(shelfId);
    if (!shelf) {
      throw new Error(`Shelf with ID ${shelfId} not found`);
    }

    // Validate book is on shelf
    const isOnShelf = await shelfRepository.isBookOnShelf(shelfId, bookId);
    if (!isOnShelf) {
      throw new Error(`Book ${bookId} is not on shelf ${shelfId}`);
    }

    logger.info({ shelfId, bookId, sortOrder }, "Updating book order on shelf");
    await shelfRepository.updateBookOrder(shelfId, bookId, sortOrder);
    logger.info({ shelfId, bookId }, "Book order updated successfully");
  }

  /**
   * Manage which shelves a book belongs to
   * Adds/removes book from shelves to match the provided shelfIds array
   */
  async manageBookShelves(bookId: number, shelfIds: number[]): Promise<void> {
    // Validate book exists
    const book = await bookRepository.findById(bookId);
    if (!book) {
      throw new Error(`Book with ID ${bookId} not found`);
    }

    // Get current shelves for the book
    const currentShelves = await shelfRepository.getShelvesForBook(bookId);
    const currentShelfIds = currentShelves.map((s) => s.id);

    // Determine which shelves to add and remove
    const shelfIdsToAdd = shelfIds.filter((id) => !currentShelfIds.includes(id));
    const shelfIdsToRemove = currentShelfIds.filter((id) => !shelfIds.includes(id));

    logger.info(
      { bookId, shelfIdsToAdd, shelfIdsToRemove },
      "Managing book shelf memberships"
    );

    // Remove from shelves
    for (const shelfId of shelfIdsToRemove) {
      await shelfRepository.removeBookFromShelf(shelfId, bookId);
    }

    // Add to shelves
    for (const shelfId of shelfIdsToAdd) {
      // Validate shelf exists
      const shelf = await shelfRepository.findById(shelfId);
      if (!shelf) {
        logger.warn({ shelfId }, "Shelf not found, skipping");
        continue;
      }
      await shelfRepository.addBookToShelf(shelfId, bookId);
    }

    logger.info({ bookId, finalShelfCount: shelfIds.length }, "Book shelves updated successfully");
  }

  /**
   * Reorder all books in a shelf
   * Books not included in orderedBookIds will be placed after the ordered ones
   */
  async reorderBooksInShelf(shelfId: number, orderedBookIds: number[]): Promise<void> {
    // Validate shelf exists
    const shelf = await shelfRepository.findById(shelfId);
    if (!shelf) {
      throw new Error(`Shelf with ID ${shelfId} not found`);
    }

    // Validate all books are on the shelf
    for (const bookId of orderedBookIds) {
      const isOnShelf = await shelfRepository.isBookOnShelf(shelfId, bookId);
      if (!isOnShelf) {
        throw new Error(`Book ${bookId} is not on shelf ${shelfId}`);
      }
    }

    logger.info({ shelfId, bookCount: orderedBookIds.length }, "Reordering books in shelf");
    await shelfRepository.reorderBooks(shelfId, orderedBookIds);
    logger.info({ shelfId }, "Books reordered successfully");
  }
}

// Export singleton instance
export const shelfService = new ShelfService();
