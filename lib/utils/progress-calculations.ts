/**
 * Progress calculation utilities
 * Centralized logic for page/percentage conversions with consistent rounding
 * 
 * All percentage calculations use Math.floor() to ensure:
 * - Book completion only occurs at exactly 100%
 * - 299/300 pages = 99% (not 100%, book not complete)
 * - 300/300 pages = 100% (truly complete)
 */

/**
 * Calculate percentage from current page and total pages
 * Uses Math.floor to prevent premature completion (e.g., 299/300 → 99%, not 100%)
 * 
 * @param currentPage - Current page number (0-based or 1-based, depends on book)
 * @param totalPages - Total pages in the book
 * @returns Percentage as integer (0-100)
 * 
 * @example
 * calculatePercentage(299, 300) // => 99 (not 100, book not complete)
 * calculatePercentage(300, 300) // => 100 (truly complete)
 * calculatePercentage(50, 100)  // => 50
 * calculatePercentage(0, 100)   // => 0
 */
export function calculatePercentage(currentPage: number, totalPages: number): number {
  if (totalPages === 0) return 0;
  if (currentPage < 0) return 0;
  if (currentPage >= totalPages) return 100;
  
  return Math.floor((currentPage / totalPages) * 100);
}

/**
 * Calculate current page from percentage and total pages
 * Uses Math.floor for consistent behavior
 * 
 * @param percentage - Progress percentage (0-100)
 * @param totalPages - Total pages in the book
 * @returns Current page number
 * 
 * @example
 * calculatePageFromPercentage(99, 300)  // => 297
 * calculatePageFromPercentage(100, 300) // => 300
 * calculatePageFromPercentage(50, 100)  // => 50
 * calculatePageFromPercentage(0, 100)   // => 0
 */
export function calculatePageFromPercentage(percentage: number, totalPages: number): number {
  if (percentage <= 0) return 0;
  if (percentage >= 100) return totalPages;
  
  return Math.floor((percentage / 100) * totalPages);
}

/**
 * Check if book is truly completed
 * More reliable than percentage >= 100 check due to rounding
 * 
 * @param currentPage - Current page number
 * @param totalPages - Total pages in the book
 * @returns True if book is complete
 * 
 * @example
 * isBookComplete(299, 300) // => false (99.67%, rounds to 99%)
 * isBookComplete(300, 300) // => true
 * isBookComplete(301, 300) // => true (over-read)
 */
export function isBookComplete(currentPage: number, totalPages: number): boolean {
  return currentPage >= totalPages;
}
