import { headers } from 'next/headers';

/**
 * Gets the base URL for server-side API fetches.
 * Automatically detects the correct URL from request headers or PORT env variable.
 * 
 * This function eliminates the need to manually set NEXT_PUBLIC_BASE_URL when
 * changing the application port. It will automatically detect the correct URL from:
 * 
 * 1. NEXT_PUBLIC_BASE_URL environment variable (explicit override)
 * 2. Request headers (host + protocol) - works in most scenarios
 * 3. PORT environment variable - fallback for server-to-server calls
 * 4. Default localhost:3000 - final fallback
 * 
 * @returns The base URL (e.g., "http://localhost:3000", "http://localhost:3301")
 * 
 * @example
 * ```typescript
 * const baseUrl = getServerBaseUrl();
 * const response = await fetch(`${baseUrl}/api/streak/analytics`);
 * ```
 */
export function getServerBaseUrl(): string {
  // 1. Honor explicit override (highest priority)
  // Useful for reverse proxies or special networking scenarios
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL;
  }

  // 2. Try to detect from incoming request headers
  // This works for most scenarios and respects the actual host/port used
  try {
    const headersList = headers();
    const host = headersList.get('host');
    
    if (host) {
      // Check for protocol from reverse proxy headers
      const protocol = headersList.get('x-forwarded-proto') || 'http';
      return `${protocol}://${host}`;
    }
  } catch (error) {
    // headers() might throw in some contexts (e.g., build time, or edge runtime)
    // Fall through to next detection method
  }

  // 3. Fallback to PORT env variable for server-to-server calls
  // This handles cases where we're making internal requests
  const port = process.env.PORT || '3000';
  return `http://localhost:${port}`;
}
