/**
 * Book API - Domain helper for book-related endpoints
 * 
 * Provides type-safe methods for all book-related API calls.
 * Uses the BaseApiClient for HTTP handling and error management.
 */

import { baseApiClient } from "../../base-client";
import type {
  UpdateStatusRequest,
  UpdateStatusResponse,
  CreateProgressRequest,
  CreateProgressResponse,
  ListProgressParams,
  ProgressLog,
  UpdateProgressRequest,
  UpdateProgressResponse,
  DeleteProgressResponse,
  UpdateRatingRequest,
  UpdateSessionReviewRequest,
  ReadingSession,
  MarkAsReadRequest,
  MarkAsReadResponse,
  StartRereadResponse,
  CompleteBookRequest,
  CompleteBookResponse,
  BookDetail,
  UpdateBookRequest,
  UpdateBookResponse,
  UpdateTagsRequest,
  UpdateTagsResponse,
} from "./types";

/**
 * Book API domain helper
 * 
 * Lightweight object with typed methods for book endpoints.
 * All methods return promises and throw ApiError on failure.
 * 
 * @example
 * import { bookApi } from '@/lib/api';
 * 
 * // Update book status
 * await bookApi.updateStatus('123', { status: 'reading' });
 * 
 * // Create progress entry
 * const result = await bookApi.createProgress('123', {
 *   currentPage: 50,
 *   notes: 'Great chapter!'
 * });
 */
export const bookApi = {
  /**
   * Update book status (to-read, read-next, reading, read, dnf)
   * 
   * @param bookId - The ID of the book
   * @param request - Status update request
   * @returns Status update response with session info
   * @throws {ApiError} When request fails
   * 
   * @example
   * await bookApi.updateStatus('123', { status: 'reading' });
   */
  updateStatus: (
    bookId: string | number,
    request: UpdateStatusRequest
  ): Promise<UpdateStatusResponse> => {
    return baseApiClient["post"]<UpdateStatusRequest, UpdateStatusResponse>(
      `/api/books/${bookId}/status`,
      request
    );
  },

  /**
   * Create progress entry for a book
   * 
   * @param bookId - The ID of the book
   * @param request - Progress data (page or percentage)
   * @returns Progress creation response with completion flag
   * @throws {ApiError} When request fails
   * 
   * @example
   * const result = await bookApi.createProgress('123', {
   *   currentPage: 150,
   *   notes: 'Finished chapter 10'
   * });
   * 
   * if (result.shouldShowCompletionModal) {
   *   // Show completion modal
   * }
   */
  createProgress: (
    bookId: string | number,
    request: CreateProgressRequest
  ): Promise<CreateProgressResponse> => {
    return baseApiClient["post"]<CreateProgressRequest, CreateProgressResponse>(
      `/api/books/${bookId}/progress`,
      request
    );
  },

  /**
   * List progress entries for a book
   * 
   * @param bookId - The ID of the book
   * @param params - Optional query parameters (e.g., sessionId filter)
   * @returns Array of progress log entries
   * @throws {ApiError} When request fails
   * 
   * @example
   * // Get all progress for a book
   * const progress = await bookApi.listProgress('123');
   * 
   * @example
   * // Get progress for a specific session
   * const sessionProgress = await bookApi.listProgress('123', { sessionId: 456 });
   */
  listProgress: (
    bookId: string | number,
    params?: ListProgressParams
  ): Promise<ProgressLog[]> => {
    const queryParams = new URLSearchParams();
    if (params?.sessionId) {
      queryParams.append('sessionId', params.sessionId.toString());
    }
    
    const url = `/api/books/${bookId}/progress${
      queryParams.toString() ? `?${queryParams.toString()}` : ''
    }`;
    
    return baseApiClient["get"]<ProgressLog[]>(url);
  },

  /**
   * Update an existing progress entry
   * 
   * @param bookId - The ID of the book
   * @param progressId - The ID of the progress entry
   * @param request - Updated progress data
   * @returns Updated progress log entry
   * @throws {ApiError} When request fails
   * 
   * @example
   * await bookApi.updateProgress('123', 789, {
   *   currentPage: 160,
   *   notes: 'Updated notes'
   * });
   */
  updateProgress: (
    bookId: string | number,
    progressId: number,
    request: UpdateProgressRequest
  ): Promise<UpdateProgressResponse> => {
    return baseApiClient["patch"]<UpdateProgressRequest, UpdateProgressResponse>(
      `/api/books/${bookId}/progress/${progressId}`,
      request
    );
  },

  /**
   * Delete progress entry
   * 
   * @param bookId - The ID of the book
   * @param progressId - The ID of the progress entry to delete
   * @returns Delete progress response
   * @throws {ApiError} When request fails
   * 
   * @example
   * await bookApi.deleteProgress('123', 789);
   */
  deleteProgress: (
    bookId: string | number,
    progressId: number
  ): Promise<DeleteProgressResponse> => {
    return baseApiClient["delete"]<undefined, DeleteProgressResponse>(
      `/api/books/${bookId}/progress/${progressId}`
    );
  },

  /**
   * Update book rating (1-5 stars)
   * 
   * @param bookId - The ID of the book
   * @param request - Rating update request
   * @returns Empty promise on success
   * @throws {ApiError} When request fails
   * 
   * @example
   * await bookApi.updateRating('123', { rating: 5 });
   */
  updateRating: (
    bookId: string | number,
    request: UpdateRatingRequest
  ): Promise<void> => {
    return baseApiClient["patch"]<UpdateRatingRequest, void>(
      `/api/books/${bookId}/rating`,
      request
    );
  },

  /**
   * Update review on a reading session
   * 
   * @param bookId - The ID of the book
   * @param sessionId - The ID of the session
   * @param request - Review update request
   * @returns Empty promise on success
   * @throws {ApiError} When request fails
   * 
   * @example
   * await bookApi.updateSessionReview('123', 456, {
   *   review: 'An amazing read!'
   * });
   */
  updateSessionReview: (
    bookId: string | number,
    sessionId: number,
    request: UpdateSessionReviewRequest
  ): Promise<void> => {
    return baseApiClient["patch"]<UpdateSessionReviewRequest, void>(
      `/api/books/${bookId}/sessions/${sessionId}`,
      request
    );
  },

  /**
   * Get all reading sessions for a book
   * 
   * @param bookId - The ID of the book
   * @returns Array of reading sessions
   * @throws {ApiError} When request fails
   * 
   * @example
   * const sessions = await bookApi.getSessions('123');
   * const completedSessions = sessions.filter(s => s.status === 'read');
   */
  getSessions: (bookId: string | number): Promise<ReadingSession[]> => {
    return baseApiClient["get"]<ReadingSession[]>(`/api/books/${bookId}/sessions`);
  },

  /**
   * Mark a book as read with optional rating and review
   *
   * Orchestrates the full "mark as read" workflow:
   * - Ensures book is in reading status
   * - Creates 100% progress entry if needed
   * - Updates rating (syncs to Calibre)
   * - Updates review on session
   * - Handles books without totalPages
   *
   * @param bookId - The ID of the book
   * @param request - Rating and review data
   * @returns Mark as read response with flags for what was updated
   * @throws {ApiError} When request fails
   *
   * @example
   * const result = await bookApi.markAsRead('123', {
   *   rating: 5,
   *   review: 'Amazing book!'
   * });
   *
   * if (result.progressCreated) {
   *   console.log('Created 100% progress entry');
   * }
   */
  markAsRead: (
    bookId: string | number,
    request: MarkAsReadRequest
  ): Promise<MarkAsReadResponse> => {
    return baseApiClient["post"]<MarkAsReadRequest, MarkAsReadResponse>(
      `/api/books/${bookId}/mark-as-read`,
      request
    );
  },

  /**
   * Start re-reading a book (archives current session and creates new one)
   *
   * @param bookId - The ID of the book
   * @returns Reread response with session IDs
   * @throws {ApiError} When request fails
   *
   * @example
   * const result = await bookApi.startReread('123');
   * console.log('Started reread with session:', result.newSessionId);
   */
  startReread: (bookId: string | number): Promise<StartRereadResponse> => {
    return baseApiClient["post"]<void, StartRereadResponse>(
      `/api/books/${bookId}/reread`,
      undefined
    );
  },

  /**
   * Complete a book (mark as read from non-reading status)
   *
   * Handles the full workflow for marking a book as read from "Want to Read" or
   * "Read Next" status. This consolidates all steps into a single API call:
   * - Updates page count if needed
   * - Creates reading session with start date
   * - Logs progress from start to finish
   * - Marks book as read with completion date
   * - Updates rating and review
   *
   * This is different from markAsRead which is used for books already in "reading"
   * status or for updating an already-read book.
   *
   * @param bookId - The ID of the book
   * @param request - Complete book data (dates, pages, rating, review)
   * @returns Complete book response
   * @throws {ApiError} When request fails
   *
   * @example
   * const result = await bookApi.completeBook('123', {
   *   totalPages: 350,
   *   startDate: '2024-01-01',
   *   endDate: '2024-01-15',
   *   rating: 5,
   *   review: 'Amazing book!'
   * });
   *
   * @example
   * // Without rating or review
   * await bookApi.completeBook('123', {
   *   startDate: '2024-01-01',
   *   endDate: '2024-01-15'
   * });
   */
  completeBook: (
    bookId: string | number,
    request: CompleteBookRequest
  ): Promise<CompleteBookResponse> => {
    return baseApiClient["post"]<CompleteBookRequest, CompleteBookResponse>(
      `/api/books/${bookId}/complete`,
      request
    );
  },

  /**
   * Get book details
   * 
   * @param bookId - The ID of the book
   * @returns Book detail response with all book info
   * @throws {ApiError} When request fails
   * 
   * @example
   * const book = await bookApi.getDetail('123');
   * console.log(`Book: ${book.title} by ${book.authors.join(', ')}`);
   */
  getDetail: (bookId: string | number): Promise<BookDetail> => {
    return baseApiClient["get"]<BookDetail>(`/api/books/${bookId}`);
  },

  /**
   * Update book details (e.g., total pages)
   * 
   * @param bookId - The ID of the book
   * @param request - Book update request
   * @returns Updated book response
   * @throws {ApiError} When request fails
   * 
   * @example
   * await bookApi.updateBook('123', { totalPages: 350 });
   */
  updateBook: (
    bookId: string | number,
    request: UpdateBookRequest
  ): Promise<UpdateBookResponse> => {
    return baseApiClient["patch"]<UpdateBookRequest, UpdateBookResponse>(
      `/api/books/${bookId}`,
      request
    );
  },

  /**
   * Update book tags
   * 
   * @param bookId - The ID of the book
   * @param request - Tags update request
   * @returns Updated book response
   * @throws {ApiError} When request fails
   * 
   * @example
   * await bookApi.updateTags('123', { tags: ['fiction', 'fantasy'] });
   */
  updateTags: (
    bookId: string | number,
    request: UpdateTagsRequest
  ): Promise<UpdateTagsResponse> => {
    return baseApiClient["patch"]<UpdateTagsRequest, UpdateTagsResponse>(
      `/api/books/${bookId}/tags`,
      request
    );
  },
};
