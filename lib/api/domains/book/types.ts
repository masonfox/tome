/**
 * TypeScript types for Book API requests and responses
 */

// ============================================================================
// Status API Types
// ============================================================================

export type BookStatus = "to-read" | "read-next" | "reading" | "read" | "dnf";

/**
 * Request to update book status
 */
export interface UpdateStatusRequest {
  status: BookStatus;
}

/**
 * Response from status update
 */
export interface UpdateStatusResponse {
  success: boolean;
  sessionArchived?: boolean;
  archivedSessionNumber?: number;
  status: string;
}

// ============================================================================
// Progress API Types
// ============================================================================

/**
 * Request to create progress entry
 */
export interface CreateProgressRequest {
  currentPage?: number;
  currentPercentage?: number;
  notes?: string;
  progressDate?: Date | string;
}

/**
 * Progress log entry
 */
export interface ProgressLog {
  id: number;
  bookId: number;
  sessionId: number;
  currentPage: number;
  currentPercentage: number;
  progressDate: string;
  notes?: string;
  pagesRead: number;
}

/**
 * Response from creating progress
 */
export interface CreateProgressResponse {
  progressLog: ProgressLog;
  shouldShowCompletionModal: boolean;
  completedSessionId?: number;
}

/**
 * Query parameters for listing progress entries
 */
export interface ListProgressParams {
  sessionId?: number;
}

/**
 * Request to update existing progress entry
 */
export interface UpdateProgressRequest {
  currentPage?: number;
  currentPercentage?: number;
  progressDate?: string;
  notes?: string;
}

/**
 * Response from updating progress
 */
export interface UpdateProgressResponse {
  progressLog: ProgressLog;
}

/**
 * Response from deleting progress entry
 */
export interface DeleteProgressResponse {
  success: boolean;
}

// ============================================================================
// Rating API Types
// ============================================================================

/**
 * Request to update rating
 */
export interface UpdateRatingRequest {
  rating: number | null; // 1-5 or null to remove rating
}

// ============================================================================
// Session API Types
// ============================================================================

/**
 * Request to update session review
 */
export interface UpdateSessionReviewRequest {
  review: string;
}

/**
 * Reading session from API
 */
export interface ReadingSession {
  id: number;
  bookId: number;
  status: string;
  isActive: boolean;
  startedDate: string;
  completedDate?: string;
  review?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Mark as Read API Types
// ============================================================================

/**
 * Request to mark a book as read
 */
export interface MarkAsReadRequest {
  rating?: number;
  review?: string;
  completedDate?: Date | string;
}

/**
 * Response from marking a book as read
 */
export interface MarkAsReadResponse {
  session: ReadingSession;
  ratingUpdated: boolean;
  reviewUpdated: boolean;
  progressCreated: boolean;
}

// ============================================================================
// Reread API Types
// ============================================================================

/**
 * Response from starting a reread
 */
export interface StartRereadResponse {
  success: boolean;
  newSessionId: number;
  archivedSessionId: number;
}

// ============================================================================
// Complete Book API Types
// ============================================================================

/**
 * Request to complete a book (mark as read from non-reading status)
 */
export interface CompleteBookRequest {
  totalPages?: number;
  startDate: string;
  endDate: string;
  rating?: number;
  review?: string;
}

/**
 * Response from completing a book
 */
export interface CompleteBookResponse {
  success: boolean;
}

// ============================================================================
// Book Detail API Types
// ============================================================================

/**
 * Book detail response
 */
export interface BookDetail {
  id: number;
  calibreId: number;
  title: string;
  authors: string[];
  totalPages?: number;
  publisher?: string;
  pubDate?: string;
  series?: string;
  seriesIndex?: number | null;
  description?: string;
  tags: string[];
  totalReads?: number;
  hasCompletedReads?: boolean;
  activeSession?: {
    id: number;
    status: string;
    startedDate?: string;
    completedDate?: string;
    review?: string;
  };
  rating?: number | null;
  latestProgress?: {
    currentPage: number;
    currentPercentage: number;
    progressDate: string;
  };
}

/**
 * Request to update book details (e.g., total pages)
 */
export interface UpdateBookRequest {
  totalPages?: number;
}

/**
 * Response from updating book details
 */
export interface UpdateBookResponse {
  success: boolean;
  book: BookDetail;
}

/**
 * Request to update book tags
 */
export interface UpdateTagsRequest {
  tags: string[];
}

/**
 * Response from updating book tags
 */
export interface UpdateTagsResponse {
  success: boolean;
  book: BookDetail;
}
