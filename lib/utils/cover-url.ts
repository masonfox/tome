/**
 * Generates a cache-busted cover URL for a book
 * 
 * Uses the Tome book ID (not Calibre ID) so covers work for all book sources.
 * Appends updatedAt timestamp as query param to force browser cache invalidation
 * when covers change.
 * 
 * @param bookId - Tome book ID
 * @param updatedAt - Book's updatedAt timestamp (optional, for cache busting)
 * @returns Cover URL with cache busting param
 * 
 * @example
 * getCoverUrl(123) // "/api/books/123/cover"
 * getCoverUrl(123, new Date()) // "/api/books/123/cover?t=1705161600000"
 * getCoverUrl(123, "2024-01-13T12:00:00Z") // "/api/books/123/cover?t=1705161600000"
 */
export function getCoverUrl(
  bookId: number,
  updatedAt?: Date | string | null
): string {
  const baseUrl = `/api/books/${bookId}/cover`;
  
  if (!updatedAt) {
    return baseUrl;
  }
  
  const timestamp = typeof updatedAt === 'string' 
    ? new Date(updatedAt).getTime() 
    : updatedAt.getTime();
  
  // Validate timestamp - fall back to base URL if invalid
  if (isNaN(timestamp)) {
    return baseUrl;
  }
  
  return `${baseUrl}?t=${timestamp}`;
}
