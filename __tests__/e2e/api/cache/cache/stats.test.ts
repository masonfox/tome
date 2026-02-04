import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "@/app/api/cache/stats/route";
import * as cache from "@/lib/covers/cache";

// Mock the cache stats functions
vi.mock("@/lib/covers/cache", async () => {
  const actual = await vi.importActual<typeof cache>(
    "@/lib/covers/cache"
  );
  return {
    ...actual,
    getCoverCacheStats: vi.fn(),
    getBookPathCacheStats: vi.fn(),
  };
});

describe("GET /api/cache/stats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return cache statistics with utilization percentages", async () => {
    // Mock cache stats
    vi.mocked(cache.getCoverCacheStats).mockReturnValue({
      size: 50,
      maxSize: 100,
      maxAgeMs: 3600000,
    });

    vi.mocked(cache.getBookPathCacheStats).mockReturnValue({
      size: 25,
      maxSize: 200,
      maxAgeMs: 3600000,
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      coverCache: {
        size: 50,
        maxSize: 100,
        maxAgeMs: 3600000,
        utilizationPercent: 50,
      },
      bookPathCache: {
        size: 25,
        maxSize: 200,
        maxAgeMs: 3600000,
        utilizationPercent: 12.5,
      },
    });
    expect(data.timestamp).toBeDefined();
    expect(new Date(data.timestamp).toString()).not.toBe("Invalid Date");
  });

  it("should handle empty caches", async () => {
    vi.mocked(cache.getCoverCacheStats).mockReturnValue({
      size: 0,
      maxSize: 100,
      maxAgeMs: 3600000,
    });

    vi.mocked(cache.getBookPathCacheStats).mockReturnValue({
      size: 0,
      maxSize: 200,
      maxAgeMs: 3600000,
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.coverCache.utilizationPercent).toBe(0);
    expect(data.bookPathCache.utilizationPercent).toBe(0);
  });

  it("should handle full caches", async () => {
    vi.mocked(cache.getCoverCacheStats).mockReturnValue({
      size: 100,
      maxSize: 100,
      maxAgeMs: 3600000,
    });

    vi.mocked(cache.getBookPathCacheStats).mockReturnValue({
      size: 200,
      maxSize: 200,
      maxAgeMs: 3600000,
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.coverCache.utilizationPercent).toBe(100);
    expect(data.bookPathCache.utilizationPercent).toBe(100);
  });

  it("should calculate utilization with decimal precision", async () => {
    vi.mocked(cache.getCoverCacheStats).mockReturnValue({
      size: 33,
      maxSize: 100,
      maxAgeMs: 3600000,
    });

    vi.mocked(cache.getBookPathCacheStats).mockReturnValue({
      size: 67,
      maxSize: 200,
      maxAgeMs: 3600000,
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.coverCache.utilizationPercent).toBe(33);
    expect(data.bookPathCache.utilizationPercent).toBe(33.5);
  });

  it("should handle zero maxSize gracefully", async () => {
    vi.mocked(cache.getCoverCacheStats).mockReturnValue({
      size: 0,
      maxSize: 0,
      maxAgeMs: 3600000,
    });

    vi.mocked(cache.getBookPathCacheStats).mockReturnValue({
      size: 0,
      maxSize: 0,
      maxAgeMs: 3600000,
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.coverCache.utilizationPercent).toBe(0);
    expect(data.bookPathCache.utilizationPercent).toBe(0);
  });

  it("should return 500 on error", async () => {
    vi.mocked(cache.getCoverCacheStats).mockImplementation(() => {
      throw new Error("Cache unavailable");
    });

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: "Failed to fetch cache statistics" });
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it("should include all required fields", async () => {
    vi.mocked(cache.getCoverCacheStats).mockReturnValue({
      size: 10,
      maxSize: 100,
      maxAgeMs: 3600000,
    });

    vi.mocked(cache.getBookPathCacheStats).mockReturnValue({
      size: 20,
      maxSize: 200,
      maxAgeMs: 7200000,
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);

    // Check coverCache fields
    expect(data.coverCache).toHaveProperty("size");
    expect(data.coverCache).toHaveProperty("maxSize");
    expect(data.coverCache).toHaveProperty("maxAgeMs");
    expect(data.coverCache).toHaveProperty("utilizationPercent");

    // Check bookPathCache fields
    expect(data.bookPathCache).toHaveProperty("size");
    expect(data.bookPathCache).toHaveProperty("maxSize");
    expect(data.bookPathCache).toHaveProperty("maxAgeMs");
    expect(data.bookPathCache).toHaveProperty("utilizationPercent");

    // Check timestamp
    expect(data).toHaveProperty("timestamp");
    expect(typeof data.timestamp).toBe("string");
  });

  it("should return current timestamp", async () => {
    vi.mocked(cache.getCoverCacheStats).mockReturnValue({
      size: 10,
      maxSize: 100,
      maxAgeMs: 3600000,
    });

    vi.mocked(cache.getBookPathCacheStats).mockReturnValue({
      size: 20,
      maxSize: 200,
      maxAgeMs: 3600000,
    });

    const beforeTime = new Date();
    const response = await GET();
    const afterTime = new Date();
    const data = await response.json();

    const timestamp = new Date(data.timestamp);
    expect(timestamp.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
    expect(timestamp.getTime()).toBeLessThanOrEqual(afterTime.getTime());
  });
});
