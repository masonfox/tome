/**
 * Shelf API - Domain helper for shelf-related endpoints
 * 
 * Provides type-safe methods for all shelf-related API calls.
 * Uses the BaseApiClient for HTTP handling and error management.
 */

import { baseApiClient } from "../../base-client";
import type {
  Shelf,
  ShelfWithBookCount,
  ShelfWithBookCountAndCovers,
  ShelfWithBooks,
  ListShelvesParams,
  GetShelfParams,
  CreateShelfRequest,
  UpdateShelfRequest,
  AddBookToShelfRequest,
  AddBooksToShelfRequest,
  UpdateBookOrderRequest,
  ReorderBooksRequest,
  ReorderBooksResponse,
  CreateShelfResponse,
  UpdateShelfResponse,
  DeleteShelfResponse,
  ListShelvesResponse,
  GetShelfResponse,
  AddBookToShelfResponse,
  AddBooksToShelfResponse,
  RemoveBookFromShelfResponse,
  UpdateBookOrderResponse,
} from "./types";

/**
 * Shelf API domain helper
 * 
 * Lightweight object with typed methods for shelf endpoints.
 * All methods return promises and throw ApiError on failure.
 * 
 * @example
 * import { shelfApi } from '@/lib/api';
 * 
 * // Get all shelves with book counts
 * const shelves = await shelfApi.list({ withCounts: true });
 * 
 * // Create a new shelf
 * const shelf = await shelfApi.create({
 *   name: 'Favorites',
 *   description: 'My favorite books',
 *   color: '#3b82f6'
 * });
 */
export const shelfApi = {
  /**
   * Get all shelves
   * 
   * @param params - Optional query parameters
   * @returns Array of shelves (with optional counts/covers)
   * @throws {ApiError} When request fails
   * 
   * @example
   * // Get basic shelves
   * const shelves = await shelfApi.list();
   * 
   * @example
   * // Get shelves with book counts
   * const shelves = await shelfApi.list({ withCounts: true });
   * 
   * @example
   * // Get shelves with book counts and cover IDs
   * const shelves = await shelfApi.list({ withCovers: true });
   */
  list: async (
    params?: ListShelvesParams
  ): Promise<Shelf[] | ShelfWithBookCount[] | ShelfWithBookCountAndCovers[]> => {
    const queryParams = new URLSearchParams();
    if (params?.withCounts) {
      queryParams.append("withCounts", "true");
    }
    if (params?.withCovers) {
      queryParams.append("withCovers", "true");
    }

    const url = `/api/shelves${
      queryParams.toString() ? `?${queryParams.toString()}` : ""
    }`;

    const response = await baseApiClient["get"]<
      ListShelvesResponse<Shelf | ShelfWithBookCount | ShelfWithBookCountAndCovers>
    >(url);

    return response.data;
  },

  /**
   * Get a specific shelf by ID
   * 
   * @param shelfId - The ID of the shelf
   * @param params - Optional query parameters
   * @returns Shelf data (with optional books)
   * @throws {ApiError} When request fails
   * 
   * @example
   * // Get shelf without books
   * const shelf = await shelfApi.get(1);
   * 
   * @example
   * // Get shelf with books
   * const shelf = await shelfApi.get(1, { withBooks: true });
   * 
   * @example
   * // Get shelf with books sorted by title
   * const shelf = await shelfApi.get(1, {
   *   withBooks: true,
   *   orderBy: 'title',
   *   direction: 'asc'
   * });
   */
  get: async (
    shelfId: number,
    params?: GetShelfParams
  ): Promise<Shelf | ShelfWithBooks> => {
    const queryParams = new URLSearchParams();
    if (params?.withBooks) {
      queryParams.append("withBooks", "true");
    }
    if (params?.orderBy) {
      queryParams.append("orderBy", params.orderBy);
    }
    if (params?.direction) {
      queryParams.append("direction", params.direction);
    }

    const url = `/api/shelves/${shelfId}${
      queryParams.toString() ? `?${queryParams.toString()}` : ""
    }`;

    const response = await baseApiClient["get"]<
      GetShelfResponse<Shelf | ShelfWithBooks>
    >(url);

    return response.data;
  },

  /**
   * Create a new shelf
   * 
   * @param request - Shelf creation data
   * @returns Created shelf
   * @throws {ApiError} When request fails
   * 
   * @example
   * const shelf = await shelfApi.create({
   *   name: 'Favorites',
   *   description: 'My favorite books',
   *   color: '#3b82f6',
   *   icon: '⭐'
   * });
   */
  create: async (request: CreateShelfRequest): Promise<Shelf> => {
    const response = await baseApiClient["post"]<
      CreateShelfRequest,
      CreateShelfResponse
    >("/api/shelves", request);

    return response.data;
  },

  /**
   * Update an existing shelf
   * 
   * @param shelfId - The ID of the shelf to update
   * @param request - Shelf update data
   * @returns Updated shelf
   * @throws {ApiError} When request fails
   * 
   * @example
   * const shelf = await shelfApi.update(1, {
   *   name: 'Top Favorites',
   *   color: '#10b981'
   * });
   */
  update: async (
    shelfId: number,
    request: UpdateShelfRequest
  ): Promise<Shelf> => {
    const response = await baseApiClient["patch"]<
      UpdateShelfRequest,
      UpdateShelfResponse
    >(`/api/shelves/${shelfId}`, request);

    return response.data;
  },

  /**
   * Delete a shelf
   * 
   * @param shelfId - The ID of the shelf to delete
   * @returns Success indicator
   * @throws {ApiError} When request fails
   * 
   * @example
   * const result = await shelfApi.delete(1);
   * console.log('Deleted:', result.deleted);
   */
  delete: async (shelfId: number): Promise<{ deleted: boolean }> => {
    const response = await baseApiClient["delete"]<DeleteShelfResponse>(
      `/api/shelves/${shelfId}`
    );

    return response.data;
  },

  /**
   * Add a book to a shelf
   * 
   * @param shelfId - The ID of the shelf
   * @param request - Book addition data
   * @returns Success indicator
   * @throws {ApiError} When request fails
   * 
   * @example
   * await shelfApi.addBook(1, { bookId: 42 });
   * 
   * @example
   * // Add book with custom sort order
   * await shelfApi.addBook(1, { bookId: 42, sortOrder: 5 });
   */
  addBook: async (
    shelfId: number,
    request: AddBookToShelfRequest
  ): Promise<{ added: boolean }> => {
    const response = await baseApiClient["post"]<
      AddBookToShelfRequest,
      AddBookToShelfResponse
    >(`/api/shelves/${shelfId}/books`, request);

    return response.data;
  },

  /**
   * Add multiple books to a shelf (bulk operation)
   * 
   * @param shelfId - The ID of the shelf
   * @param request - Array of book IDs to add
   * @returns Success indicator with count
   * @throws {ApiError} When request fails
   * 
   * @example
   * const result = await shelfApi.addBooks(1, { bookIds: [42, 43, 44] });
   * console.log(`Added ${result.count} books`);
   */
  addBooks: async (
    shelfId: number,
    request: AddBooksToShelfRequest
  ): Promise<{ added: boolean; count: number }> => {
    const response = await baseApiClient["post"]<
      AddBooksToShelfRequest,
      AddBooksToShelfResponse
    >(`/api/shelves/${shelfId}/books/bulk`, request);

    return response.data;
  },

  /**
   * Remove a book from a shelf
   * 
   * @param shelfId - The ID of the shelf
   * @param bookId - The ID of the book to remove
   * @returns Success indicator
   * @throws {ApiError} When request fails
   * 
   * @example
   * await shelfApi.removeBook(1, 42);
   */
  removeBook: async (
    shelfId: number,
    bookId: number
  ): Promise<{ removed: boolean }> => {
    const response = await baseApiClient["delete"]<RemoveBookFromShelfResponse>(
      `/api/shelves/${shelfId}/books?bookId=${bookId}`
    );

    return response.data;
  },

  /**
   * Update the sort order of a book on a shelf
   * 
   * @param shelfId - The ID of the shelf
   * @param request - Book order update data
   * @returns Success indicator
   * @throws {ApiError} When request fails
   * 
   * @example
   * await shelfApi.updateBookOrder(1, { bookId: 42, sortOrder: 10 });
   */
  updateBookOrder: async (
    shelfId: number,
    request: UpdateBookOrderRequest
  ): Promise<{ updated: boolean }> => {
    const response = await baseApiClient["patch"]<
      UpdateBookOrderRequest,
      UpdateBookOrderResponse
    >(`/api/shelves/${shelfId}/books`, request);

    return response.data;
  },

  /**
   * Batch reorder books on a shelf
   * 
   * Updates the sort order of multiple books in one request by specifying
   * the desired order of book IDs. More efficient than calling updateBookOrder
   * for each book individually.
   * 
   * @param shelfId - The ID of the shelf
   * @param request - Book IDs in desired order
   * @returns Success indicator
   * @throws {ApiError} When request fails
   * 
   * @example
   * // Reorder 4 books - first book gets sortOrder 0, second gets 1, etc.
   * await shelfApi.reorderBooks(1, { 
   *   bookIds: [42, 15, 89, 3] 
   * });
   */
  reorderBooks: async (
    shelfId: number,
    request: ReorderBooksRequest
  ): Promise<{ reordered: boolean }> => {
    const response = await baseApiClient["put"]<
      ReorderBooksRequest,
      ReorderBooksResponse
    >(`/api/shelves/${shelfId}/books/reorder`, request);

    return response.data;
  },
};
