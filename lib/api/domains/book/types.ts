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

// ============================================================================
// Rating API Types
// ============================================================================

/**
 * Request to update rating
 */
export interface UpdateRatingRequest {
  rating: number; // 1-5
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
