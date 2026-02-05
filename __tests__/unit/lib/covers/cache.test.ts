/**
 * Cover Cache Tests
 * Tests the LRU cache logic for cover images and book paths
 */

import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  coverCache,
  bookPathCache,
  clearCoverCache,
  clearBookPathCache,
  getCoverCacheStats,
  getBookPathCacheStats,
} from '@/lib/covers/cache';
import { CACHE_CONFIG } from '@/lib/constants';

describe('CoverCache', () => {
  beforeEach(() => {
    clearCoverCache();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Cache Hit/Miss', () => {
    test('should return null for cache miss', () => {
      const result = coverCache.get(999);
      expect(result).toBeNull();
    });

    test('should return cached entry on cache hit', () => {
      const buffer = Buffer.from('test-image-data');
      const contentType = 'image/jpeg';

      coverCache.set(147, buffer, contentType);
      const result = coverCache.get(147);

      expect(result).not.toBeNull();
      expect(result!.buffer).toEqual(buffer);
      expect(result!.contentType).toBe(contentType);
      expect(result!.timestamp).toBeLessThanOrEqual(Date.now());
    });

    test('should handle multiple different book IDs', () => {
      const buffer1 = Buffer.from('book-1-cover');
      const buffer2 = Buffer.from('book-2-cover');

      coverCache.set(147, buffer1, 'image/jpeg');
      coverCache.set(83, buffer2, 'image/png');

      const result1 = coverCache.get(147);
      const result2 = coverCache.get(83);

      expect(result1!.buffer).toEqual(buffer1);
      expect(result1!.contentType).toBe('image/jpeg');
      expect(result2!.buffer).toEqual(buffer2);
      expect(result2!.contentType).toBe('image/png');
    });
  });

  describe('TTL Expiration', () => {
    test('should return null for expired entry', () => {
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now);

      const buffer = Buffer.from('test-image');
      coverCache.set(147, buffer, 'image/jpeg');

      // Fast-forward past TTL (24 hours + 1ms)
      vi.setSystemTime(now + CACHE_CONFIG.COVER_CACHE.MAX_AGE_MS + 1);

      const result = coverCache.get(147);
      expect(result).toBeNull();

      vi.useRealTimers();
    });

    test('should return cached entry before expiration', () => {
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now);

      const buffer = Buffer.from('test-image');
      coverCache.set(147, buffer, 'image/jpeg');

      // Fast-forward just before TTL (24 hours - 1ms)
      vi.setSystemTime(now + CACHE_CONFIG.COVER_CACHE.MAX_AGE_MS - 1);

      const result = coverCache.get(147);
      expect(result).not.toBeNull();
      expect(result!.buffer).toEqual(buffer);

      vi.useRealTimers();
    });

    test('should remove expired entry from cache', () => {
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now);

      coverCache.set(147, Buffer.from('test'), 'image/jpeg');
      expect(coverCache.getSize()).toBe(1);

      // Expire the entry
      vi.setSystemTime(now + CACHE_CONFIG.COVER_CACHE.MAX_AGE_MS + 1);
      coverCache.get(147); // Triggers cleanup

      expect(coverCache.getSize()).toBe(0);

      vi.useRealTimers();
    });
  });

  describe('LRU Eviction', () => {
    test('should evict oldest entry when cache is full', () => {
      const maxSize = CACHE_CONFIG.COVER_CACHE.MAX_SIZE;

      // Fill cache to max size
      for (let i = 0; i < maxSize; i++) {
        coverCache.set(i, Buffer.from(`book-${i}`), 'image/jpeg');
      }

      expect(coverCache.getSize()).toBe(maxSize);

      // Verify first entry exists
      expect(coverCache.get(0)).not.toBeNull();

      // Add one more entry (should evict book ID 0)
      coverCache.set(9999, Buffer.from('new-book'), 'image/jpeg');

      expect(coverCache.getSize()).toBe(maxSize);
      expect(coverCache.get(0)).toBeNull(); // Evicted
      expect(coverCache.get(9999)).not.toBeNull(); // New entry exists
      expect(coverCache.get(1)).not.toBeNull(); // Second entry still exists
    });

    test('should maintain FIFO order for eviction', () => {
      const maxSize = CACHE_CONFIG.COVER_CACHE.MAX_SIZE;

      // Fill cache
      for (let i = 0; i < maxSize; i++) {
        coverCache.set(i, Buffer.from(`book-${i}`), 'image/jpeg');
      }

      // Add 3 more entries (should evict IDs 0, 1, 2)
      coverCache.set(maxSize, Buffer.from('new-1'), 'image/jpeg');
      coverCache.set(maxSize + 1, Buffer.from('new-2'), 'image/jpeg');
      coverCache.set(maxSize + 2, Buffer.from('new-3'), 'image/jpeg');

      expect(coverCache.get(0)).toBeNull();
      expect(coverCache.get(1)).toBeNull();
      expect(coverCache.get(2)).toBeNull();
      expect(coverCache.get(3)).not.toBeNull();
      expect(coverCache.get(maxSize)).not.toBeNull();
      expect(coverCache.get(maxSize + 1)).not.toBeNull();
      expect(coverCache.get(maxSize + 2)).not.toBeNull();
    });
  });

  describe('Clear Cache', () => {
    test('should clear all entries', () => {
      coverCache.set(147, Buffer.from('test-1'), 'image/jpeg');
      coverCache.set(83, Buffer.from('test-2'), 'image/png');
      coverCache.set(40, Buffer.from('test-3'), 'image/jpeg');

      expect(coverCache.getSize()).toBe(3);

      clearCoverCache();

      expect(coverCache.getSize()).toBe(0);
      expect(coverCache.get(147)).toBeNull();
      expect(coverCache.get(83)).toBeNull();
      expect(coverCache.get(40)).toBeNull();
    });
  });

  describe('Cache Stats', () => {
    test('should return correct cache statistics', () => {
      coverCache.set(147, Buffer.from('test-1'), 'image/jpeg');
      coverCache.set(83, Buffer.from('test-2'), 'image/png');

      const stats = getCoverCacheStats();

      expect(stats.size).toBe(2);
      expect(stats.maxSize).toBe(CACHE_CONFIG.COVER_CACHE.MAX_SIZE);
      expect(stats.maxAgeMs).toBe(CACHE_CONFIG.COVER_CACHE.MAX_AGE_MS);
    });

    test('should reflect size changes', () => {
      expect(getCoverCacheStats().size).toBe(0);

      coverCache.set(1, Buffer.from('test'), 'image/jpeg');
      expect(getCoverCacheStats().size).toBe(1);

      coverCache.set(2, Buffer.from('test'), 'image/jpeg');
      expect(getCoverCacheStats().size).toBe(2);

      clearCoverCache();
      expect(getCoverCacheStats().size).toBe(0);
    });
  });

  describe('Overwrite Existing Entry', () => {
    test('should overwrite existing entry with same book ID', () => {
      const buffer1 = Buffer.from('old-cover');
      const buffer2 = Buffer.from('new-cover');

      coverCache.set(147, buffer1, 'image/jpeg');
      expect(coverCache.getSize()).toBe(1);

      coverCache.set(147, buffer2, 'image/png');
      expect(coverCache.getSize()).toBe(1); // Size unchanged

      const result = coverCache.get(147);
      expect(result!.buffer).toEqual(buffer2);
      expect(result!.contentType).toBe('image/png');
    });
  });
});

describe('BookPathCache', () => {
  beforeEach(() => {
    clearBookPathCache();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Cache Hit/Miss', () => {
    test('should return null for cache miss', () => {
      const result = bookPathCache.get(999);
      expect(result).toBeNull();
    });

    test('should return cached entry on cache hit', () => {
      bookPathCache.set(147, '/path/to/book', true);
      const result = bookPathCache.get(147);

      expect(result).not.toBeNull();
      expect(result!.path).toBe('/path/to/book');
      expect(result!.hasCover).toBe(true);
    });

    test('should handle books with and without covers', () => {
      bookPathCache.set(147, '/path/dune', true);
      bookPathCache.set(83, '/path/children', false);

      const result1 = bookPathCache.get(147);
      const result2 = bookPathCache.get(83);

      expect(result1!.hasCover).toBe(true);
      expect(result2!.hasCover).toBe(false);
    });
  });

  describe('TTL Expiration', () => {
    test('should return null for expired entry', () => {
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now);

      bookPathCache.set(147, '/path/to/book', true);

      // Fast-forward past TTL (1 hour + 1ms)
      vi.setSystemTime(now + CACHE_CONFIG.BOOK_PATH_CACHE.MAX_AGE_MS + 1);

      const result = bookPathCache.get(147);
      expect(result).toBeNull();

      vi.useRealTimers();
    });

    test('should return cached entry before expiration', () => {
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now);

      bookPathCache.set(147, '/path/to/book', true);

      // Fast-forward just before TTL (1 hour - 1ms)
      vi.setSystemTime(now + CACHE_CONFIG.BOOK_PATH_CACHE.MAX_AGE_MS - 1);

      const result = bookPathCache.get(147);
      expect(result).not.toBeNull();
      expect(result!.path).toBe('/path/to/book');

      vi.useRealTimers();
    });

    test('should remove expired entry from cache', () => {
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now);

      bookPathCache.set(147, '/path/to/book', true);
      expect(bookPathCache.getSize()).toBe(1);

      // Expire the entry
      vi.setSystemTime(now + CACHE_CONFIG.BOOK_PATH_CACHE.MAX_AGE_MS + 1);
      bookPathCache.get(147); // Triggers cleanup

      expect(bookPathCache.getSize()).toBe(0);

      vi.useRealTimers();
    });
  });

  describe('LRU Eviction', () => {
    test('should evict oldest entry when cache is full', () => {
      const maxSize = CACHE_CONFIG.BOOK_PATH_CACHE.MAX_SIZE;

      // Fill cache to max size
      for (let i = 0; i < maxSize; i++) {
        bookPathCache.set(i, `/path/${i}`, true);
      }

      expect(bookPathCache.getSize()).toBe(maxSize);

      // Verify first entry exists
      expect(bookPathCache.get(0)).not.toBeNull();

      // Add one more entry (should evict book ID 0)
      bookPathCache.set(9999, '/path/new', false);

      expect(bookPathCache.getSize()).toBe(maxSize);
      expect(bookPathCache.get(0)).toBeNull(); // Evicted
      expect(bookPathCache.get(9999)).not.toBeNull(); // New entry exists
      expect(bookPathCache.get(1)).not.toBeNull(); // Second entry still exists
    });

    test('should maintain FIFO order for eviction', () => {
      const maxSize = CACHE_CONFIG.BOOK_PATH_CACHE.MAX_SIZE;

      // Fill cache
      for (let i = 0; i < maxSize; i++) {
        bookPathCache.set(i, `/path/${i}`, true);
      }

      // Add 3 more entries (should evict IDs 0, 1, 2)
      bookPathCache.set(maxSize, '/path/new-1', true);
      bookPathCache.set(maxSize + 1, '/path/new-2', false);
      bookPathCache.set(maxSize + 2, '/path/new-3', true);

      expect(bookPathCache.get(0)).toBeNull();
      expect(bookPathCache.get(1)).toBeNull();
      expect(bookPathCache.get(2)).toBeNull();
      expect(bookPathCache.get(3)).not.toBeNull();
      expect(bookPathCache.get(maxSize)).not.toBeNull();
      expect(bookPathCache.get(maxSize + 1)).not.toBeNull();
      expect(bookPathCache.get(maxSize + 2)).not.toBeNull();
    });
  });

  describe('Clear Cache', () => {
    test('should clear all entries', () => {
      bookPathCache.set(147, '/path/1', true);
      bookPathCache.set(83, '/path/2', false);
      bookPathCache.set(40, '/path/3', true);

      expect(bookPathCache.getSize()).toBe(3);

      clearBookPathCache();

      expect(bookPathCache.getSize()).toBe(0);
      expect(bookPathCache.get(147)).toBeNull();
      expect(bookPathCache.get(83)).toBeNull();
      expect(bookPathCache.get(40)).toBeNull();
    });
  });

  describe('Cache Stats', () => {
    test('should return correct cache statistics', () => {
      bookPathCache.set(147, '/path/1', true);
      bookPathCache.set(83, '/path/2', false);

      const stats = getBookPathCacheStats();

      expect(stats.size).toBe(2);
      expect(stats.maxSize).toBe(CACHE_CONFIG.BOOK_PATH_CACHE.MAX_SIZE);
      expect(stats.maxAgeMs).toBe(CACHE_CONFIG.BOOK_PATH_CACHE.MAX_AGE_MS);
    });

    test('should reflect size changes', () => {
      expect(getBookPathCacheStats().size).toBe(0);

      bookPathCache.set(1, '/path/1', true);
      expect(getBookPathCacheStats().size).toBe(1);

      bookPathCache.set(2, '/path/2', false);
      expect(getBookPathCacheStats().size).toBe(2);

      clearBookPathCache();
      expect(getBookPathCacheStats().size).toBe(0);
    });
  });

  describe('Overwrite Existing Entry', () => {
    test('should overwrite existing entry with same book ID', () => {
      bookPathCache.set(147, '/old/path', true);
      expect(bookPathCache.getSize()).toBe(1);

      bookPathCache.set(147, '/new/path', false);
      expect(bookPathCache.getSize()).toBe(1); // Size unchanged

      const result = bookPathCache.get(147);
      expect(result!.path).toBe('/new/path');
      expect(result!.hasCover).toBe(false);
    });
  });
});
