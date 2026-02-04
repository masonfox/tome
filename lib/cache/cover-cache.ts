/**
 * Cover image and book path caching utilities
 *
 * Extracted from API route to allow usage in lib/ modules without
 * depending on next/server.
 */

import { CACHE_CONFIG } from "@/lib/constants";

// LRU Cache for cover images
interface CoverCacheEntry {
  buffer: Buffer;
  contentType: string;
  timestamp: number;
}

export class CoverCache {
  private cache = new Map<number, CoverCacheEntry>();
  private maxSize = CACHE_CONFIG.COVER_CACHE.MAX_SIZE;
  private maxAge = CACHE_CONFIG.COVER_CACHE.MAX_AGE_MS;

  get(bookId: number): CoverCacheEntry | null {
    const entry = this.cache.get(bookId);
    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.timestamp > this.maxAge) {
      this.cache.delete(bookId);
      return null;
    }

    return entry;
  }

  set(bookId: number, buffer: Buffer, contentType: string): void {
    // Implement LRU by deleting oldest entries when at capacity
    if (this.cache.size >= this.maxSize) {
      // Delete oldest entry (first entry in Map)
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(bookId, {
      buffer,
      contentType,
      timestamp: Date.now(),
    });
  }

  clear(): void {
    this.cache.clear();
  }

  getSize(): number {
    return this.cache.size;
  }
}

// Cache for book path lookups (avoid repeated Calibre DB queries)
interface BookPathCacheEntry {
  path: string;
  hasCover: boolean;
  timestamp: number;
}

export class BookPathCache {
  private cache = new Map<number, BookPathCacheEntry>();
  private maxSize = CACHE_CONFIG.BOOK_PATH_CACHE.MAX_SIZE;
  private maxAge = CACHE_CONFIG.BOOK_PATH_CACHE.MAX_AGE_MS;

  get(bookId: number): BookPathCacheEntry | null {
    const entry = this.cache.get(bookId);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > this.maxAge) {
      this.cache.delete(bookId);
      return null;
    }

    return entry;
  }

  set(bookId: number, path: string, hasCover: boolean): void {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(bookId, {
      path,
      hasCover,
      timestamp: Date.now(),
    });
  }

  clear(): void {
    this.cache.clear();
  }

  getSize(): number {
    return this.cache.size;
  }
}

// Global cache instances
export const coverCache = new CoverCache();
export const bookPathCache = new BookPathCache();

// Cache management functions for use during Calibre sync
export function clearCoverCache(): void {
  coverCache.clear();
}

export function clearBookPathCache(): void {
  bookPathCache.clear();
}

// Cache statistics for monitoring and observability
export interface CacheStats {
  size: number;
  maxSize: number;
  maxAgeMs: number;
}

export function getCoverCacheStats(): CacheStats {
  return {
    size: coverCache.getSize(),
    maxSize: CACHE_CONFIG.COVER_CACHE.MAX_SIZE,
    maxAgeMs: CACHE_CONFIG.COVER_CACHE.MAX_AGE_MS,
  };
}

export function getBookPathCacheStats(): CacheStats {
  return {
    size: bookPathCache.getSize(),
    maxSize: CACHE_CONFIG.BOOK_PATH_CACHE.MAX_SIZE,
    maxAgeMs: CACHE_CONFIG.BOOK_PATH_CACHE.MAX_AGE_MS,
  };
}
