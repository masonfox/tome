/**
 * Generates a cache-busted cover URL for a book
 * 
 * Appends lastSynced timestamp as query param to force browser
 * cache invalidation when covers change in Calibre
 * 
 * @param calibreId - Calibre book ID
 * @param lastSynced - Last sync timestamp (optional)
 * @returns Cover URL with cache busting param
 * 
 * @example
 * getCoverUrl(123) // "/api/books/123/cover"
 * getCoverUrl(123, new Date()) // "/api/books/123/cover?t=1705161600000"
 * getCoverUrl(123, "2024-01-13T12:00:00Z") // "/api/books/123/cover?t=1705161600000"
 */
export function getCoverUrl(
  calibreId: number,
  lastSynced?: Date | string | null
): string {
  const baseUrl = `/api/books/${calibreId}/cover`;
  
  if (!lastSynced) {
    return baseUrl;
  }
  
  const timestamp = typeof lastSynced === 'string' 
    ? new Date(lastSynced).getTime() 
    : lastSynced.getTime();
  
  // Validate timestamp - fall back to base URL if invalid
  if (isNaN(timestamp)) {
    return baseUrl;
  }
  
  return `${baseUrl}?t=${timestamp}`;
}
