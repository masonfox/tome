/**
 * Delay utility for retry logic and rate limiting
 * 
 * Provides a simple async/await wrapper around setTimeout for cleaner
 * asynchronous delay patterns (e.g., exponential backoff in retry logic).
 * 
 * @example
 * ```typescript
 * // Simple delay
 * await delay(1000); // Wait 1 second
 * 
 * // Exponential backoff
 * for (let attempt = 1; attempt <= 3; attempt++) {
 *   try {
 *     await riskyOperation();
 *     break;
 *   } catch (error) {
 *     await delay(1000 * attempt); // 1s, 2s, 3s
 *   }
 * }
 * ```
 */

/**
 * Delays execution for the specified number of milliseconds
 * 
 * @param ms - Number of milliseconds to delay
 * @returns Promise that resolves after the delay
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
