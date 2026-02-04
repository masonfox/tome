/**
 * TypeScript types for Shelf API requests and responses
 */

// ============================================================================
// Shelf Base Types
// ============================================================================

/**
 * Core shelf data
 */
export interface Shelf {
  id: number;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Shelf with book count
 */
export interface ShelfWithBookCount extends Shelf {
  bookCount: number;
}

/**
 * Shelf with book count and cover IDs
 */
export interface ShelfWithBookCountAndCovers extends ShelfWithBookCount {
  bookCoverIds: number[];
}

/**
 * Book in shelf with calibre data
 */
export interface BookInShelf {
  id: number;
  calibreId: number;
  title: string;
  authors: string[];
  sortOrder: number;
  totalPages?: number;
  publisher?: string;
  pubDate?: string;
  series?: string;
  seriesIndex?: number | null;
  tags: string[];
  rating?: number | null;
}

/**
 * Shelf with books array
 */
export interface ShelfWithBooks extends Shelf {
  books: BookInShelf[];
}

// ============================================================================
// Shelf API Query Parameters
// ============================================================================

/**
 * Query parameters for listing shelves
 */
export interface ListShelvesParams {
  withCounts?: boolean;
  withCovers?: boolean;
}

/**
 * Query parameters for getting a shelf
 */
export interface GetShelfParams {
  withBooks?: boolean;
  orderBy?: "sortOrder" | "title" | "author" | "series" | "rating" | "pages" | "dateAdded";
  direction?: "asc" | "desc";
}

// ============================================================================
// Shelf API Request Types
// ============================================================================

/**
 * Request to create a new shelf
 */
export interface CreateShelfRequest {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
}

/**
 * Request to update a shelf
 */
export interface UpdateShelfRequest {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
}

/**
 * Request to add a book to a shelf
 */
export interface AddBookToShelfRequest {
  bookId: number;
  sortOrder?: number;
}

/**
 * Request to add multiple books to a shelf (bulk operation)
 */
export interface AddBooksToShelfRequest {
  bookIds: number[];
}

/**
 * Request to update book order on a shelf
 */
export interface UpdateBookOrderRequest {
  bookId: number;
  sortOrder: number;
}

/**
 * Request to batch reorder books on a shelf
 */
export interface ReorderBooksRequest {
  bookIds: number[];
}

/**
 * Request to add multiple books to a shelf (bulk operation)
 */
export interface AddBooksToShelfRequest {
  bookIds: number[];
}

/**
 * Request to remove multiple books from a shelf (bulk operation)
 */
export interface RemoveBooksFromShelfRequest {
  bookIds: number[];
}

// ============================================================================
// Shelf API Response Types
// ============================================================================

/**
 * Response from creating a shelf
 */
export interface CreateShelfResponse {
  success: boolean;
  data: Shelf;
}

/**
 * Response from updating a shelf
 */
export interface UpdateShelfResponse {
  success: boolean;
  data: Shelf;
}

/**
 * Response from deleting a shelf
 */
export interface DeleteShelfResponse {
  success: boolean;
  data: { deleted: boolean };
}

/**
 * Response from getting shelves
 */
export interface ListShelvesResponse<T = Shelf> {
  success: boolean;
  data: T[];
}

/**
 * Response from getting a single shelf
 */
export interface GetShelfResponse<T = Shelf> {
  success: boolean;
  data: T;
}

/**
 * Response from adding a book to a shelf
 */
export interface AddBookToShelfResponse {
  success: boolean;
  data: { added: boolean };
}

/**
 * Response from removing a book from a shelf
 */
export interface RemoveBookFromShelfResponse {
  success: boolean;
  data: { removed: boolean };
}

/**
 * Response from updating book order on a shelf
 */
export interface UpdateBookOrderResponse {
  success: boolean;
  data: { updated: boolean };
}

/**
 * Response from batch reordering books on a shelf
 */
export interface ReorderBooksResponse {
  success: boolean;
  data: { reordered: boolean };
}

/**
 * Response from adding multiple books to a shelf (bulk operation)
 */
export interface AddBooksToShelfResponse {
  success: boolean;
  data: {
    added: boolean;
    count: number;
  };
}

/**
 * Response from removing multiple books from a shelf (bulk operation)
 */
export interface RemoveBooksFromShelfResponse {
  success: boolean;
  data: {
    removed: boolean;
    count: number;
  };
}

// ============================================================================
// Base API Response (for error handling)
// ============================================================================

export interface ApiResponse {
  success: boolean;
}
