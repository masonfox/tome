/**
 * Cover Cache Management
 * Separated from route handler to comply with Next.js App Router restrictions
 */

import { CACHE_CONFIG } from "@/lib/constants";

// LRU Cache for cover images
interface CoverCacheEntry {
  buffer: Buffer;
  contentType: string;
  timestamp: number;
}

class CoverCache {
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
    // Evict oldest entry if cache is full (simple FIFO eviction)
    if (this.cache.size >= this.maxSize) {
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

// Book path cache entry
interface BookPathCacheEntry {
  path: string;
  hasCover: boolean;
  timestamp: number;
}

class BookPathCache {
  private cache = new Map<number, BookPathCacheEntry>();
  private maxSize = CACHE_CONFIG.BOOK_PATH_CACHE.MAX_SIZE;
  private maxAge = CACHE_CONFIG.BOOK_PATH_CACHE.MAX_AGE_MS;

  get(bookId: number): { path: string; hasCover: boolean } | null {
    const entry = this.cache.get(bookId);
    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.timestamp > this.maxAge) {
      this.cache.delete(bookId);
      return null;
    }

    return {
      path: entry.path,
      hasCover: entry.hasCover,
    };
  }

  set(bookId: number, path: string, hasCover: boolean): void {
    // Evict oldest entry if cache is full (simple FIFO eviction)
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

// Singleton instances
export const coverCache = new CoverCache();
export const bookPathCache = new BookPathCache();

// Exported cache management functions for use during Calibre sync
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
