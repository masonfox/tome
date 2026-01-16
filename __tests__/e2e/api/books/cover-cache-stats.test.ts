import { describe, it, expect, beforeEach } from "vitest";
import {
  clearCoverCache,
  clearBookPathCache,
  getCoverCacheStats,
  getBookPathCacheStats,
  type CacheStats,
} from "@/app/api/books/[id]/cover/route";

describe("Cover Cache Statistics", () => {
  beforeEach(() => {
    // Clear caches before each test for isolation
    clearCoverCache();
    clearBookPathCache();
  });

  describe("getCoverCacheStats", () => {
    it("should return cache statistics with correct structure", () => {
      const stats = getCoverCacheStats();

      expect(stats).toHaveProperty("size");
      expect(stats).toHaveProperty("maxSize");
      expect(stats).toHaveProperty("maxAgeMs");
    });

    it("should return numeric values for all properties", () => {
      const stats = getCoverCacheStats();

      expect(typeof stats.size).toBe("number");
      expect(typeof stats.maxSize).toBe("number");
      expect(typeof stats.maxAgeMs).toBe("number");
    });

    it("should return size of 0 after cache is cleared", () => {
      clearCoverCache();
      const stats = getCoverCacheStats();

      expect(stats.size).toBe(0);
    });

    it("should have maxSize greater than 0", () => {
      const stats = getCoverCacheStats();

      expect(stats.maxSize).toBeGreaterThan(0);
    });

    it("should have maxAgeMs greater than 0", () => {
      const stats = getCoverCacheStats();

      expect(stats.maxAgeMs).toBeGreaterThan(0);
    });

    it("should return consistent maxSize across multiple calls", () => {
      const stats1 = getCoverCacheStats();
      const stats2 = getCoverCacheStats();

      expect(stats1.maxSize).toBe(stats2.maxSize);
    });

    it("should return consistent maxAgeMs across multiple calls", () => {
      const stats1 = getCoverCacheStats();
      const stats2 = getCoverCacheStats();

      expect(stats1.maxAgeMs).toBe(stats2.maxAgeMs);
    });
  });

  describe("getBookPathCacheStats", () => {
    it("should return cache statistics with correct structure", () => {
      const stats = getBookPathCacheStats();

      expect(stats).toHaveProperty("size");
      expect(stats).toHaveProperty("maxSize");
      expect(stats).toHaveProperty("maxAgeMs");
    });

    it("should return numeric values for all properties", () => {
      const stats = getBookPathCacheStats();

      expect(typeof stats.size).toBe("number");
      expect(typeof stats.maxSize).toBe("number");
      expect(typeof stats.maxAgeMs).toBe("number");
    });

    it("should return size of 0 after cache is cleared", () => {
      clearBookPathCache();
      const stats = getBookPathCacheStats();

      expect(stats.size).toBe(0);
    });

    it("should have maxSize greater than 0", () => {
      const stats = getBookPathCacheStats();

      expect(stats.maxSize).toBeGreaterThan(0);
    });

    it("should have maxAgeMs greater than 0", () => {
      const stats = getBookPathCacheStats();

      expect(stats.maxAgeMs).toBeGreaterThan(0);
    });

    it("should return consistent maxSize across multiple calls", () => {
      const stats1 = getBookPathCacheStats();
      const stats2 = getBookPathCacheStats();

      expect(stats1.maxSize).toBe(stats2.maxSize);
    });

    it("should return consistent maxAgeMs across multiple calls", () => {
      const stats1 = getBookPathCacheStats();
      const stats2 = getBookPathCacheStats();

      expect(stats1.maxAgeMs).toBe(stats2.maxAgeMs);
    });
  });

  describe("Cache clearing operations", () => {
    it("should clear cover cache without errors", () => {
      expect(() => clearCoverCache()).not.toThrow();
    });

    it("should clear book path cache without errors", () => {
      expect(() => clearBookPathCache()).not.toThrow();
    });

    it("should reset cover cache size to 0 after clearing", () => {
      clearCoverCache();
      const stats = getCoverCacheStats();

      expect(stats.size).toBe(0);
    });

    it("should reset book path cache size to 0 after clearing", () => {
      clearBookPathCache();
      const stats = getBookPathCacheStats();

      expect(stats.size).toBe(0);
    });

    it("should allow multiple consecutive cache clears", () => {
      expect(() => {
        clearCoverCache();
        clearCoverCache();
        clearCoverCache();
      }).not.toThrow();
    });

    it("should maintain independent cache statistics", () => {
      const coverStats = getCoverCacheStats();
      const pathStats = getBookPathCacheStats();

      // Caches should have different configurations
      expect(coverStats.maxSize).not.toBe(pathStats.maxSize);
    });
  });

  describe("CacheStats type validation", () => {
    it("should match CacheStats interface for cover cache", () => {
      const stats: CacheStats = getCoverCacheStats();

      expect(stats).toBeDefined();
      expect(stats.size).toBeGreaterThanOrEqual(0);
      expect(stats.maxSize).toBeGreaterThan(0);
      expect(stats.maxAgeMs).toBeGreaterThan(0);
    });

    it("should match CacheStats interface for book path cache", () => {
      const stats: CacheStats = getBookPathCacheStats();

      expect(stats).toBeDefined();
      expect(stats.size).toBeGreaterThanOrEqual(0);
      expect(stats.maxSize).toBeGreaterThan(0);
      expect(stats.maxAgeMs).toBeGreaterThan(0);
    });
  });
});
