import { test, expect, describe, beforeEach, afterEach, mock } from "bun:test";
import { renderHook, waitFor } from "../test-utils";
import { useStats } from "@/hooks/useStats";

const originalFetch = global.fetch;

describe("useStats", () => {
  const mockStatsOverview = {
    booksRead: {
      total: 50,
      thisYear: 15,
      thisMonth: 3,
    },
    currentlyReading: 5,
    pagesRead: {
      total: 15000,
      thisYear: 5000,
      thisMonth: 800,
      today: 50,
    },
    avgPagesPerDay: 42,
  };

  const mockStreakData = {
    currentStreak: 10,
    longestStreak: 25,
    dailyThreshold: 15,
    totalDaysActive: 100,
    streakEnabled: true,
    userTimezone: "America/New_York",
    hoursRemainingToday: 8,
  };

  beforeEach(() => {
    global.fetch = mock((url: string) => {
      if (url === "/api/stats/overview") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockStatsOverview),
        } as Response);
      }
      if (url === "/api/streaks") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockStreakData),
        } as Response);
      }
      return Promise.reject(new Error("Unknown URL"));
    }) as any;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("initialization", () => {
    test("should start with loading state", () => {
      const { result } = renderHook(() => useStats());

      expect(result.current.isLoading).toBe(true);
      expect(result.current.stats).toBeNull();
      expect(result.current.streak).toBeNull();
    });

    test("should fetch both stats and streak data on mount", async () => {
      const { result } = renderHook(() => useStats());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(global.fetch).toHaveBeenCalledWith("/api/stats/overview", {
        cache: "no-store",
      });
      expect(global.fetch).toHaveBeenCalledWith("/api/streaks", {
        cache: "no-store",
      });
    });
  });

  describe("data fetching", () => {
    test("should return both stats and streak data after successful fetch", async () => {
      const { result } = renderHook(() => useStats());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.stats).toEqual(mockStatsOverview);
      expect(result.current.streak).toEqual(mockStreakData);
    });

    test("should handle null stats", async () => {
      global.fetch = mock((url: string) => {
        if (url === "/api/stats/overview") {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(null),
          } as Response);
        }
        if (url === "/api/streaks") {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockStreakData),
          } as Response);
        }
        return Promise.reject(new Error("Unknown URL"));
      }) as any;

      const { result } = renderHook(() => useStats());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.stats).toBeNull();
      expect(result.current.streak).toEqual(mockStreakData);
    });

    test("should handle null streak", async () => {
      global.fetch = mock((url: string) => {
        if (url === "/api/stats/overview") {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockStatsOverview),
          } as Response);
        }
        if (url === "/api/streaks") {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(null),
          } as Response);
        }
        return Promise.reject(new Error("Unknown URL"));
      }) as any;

      const { result } = renderHook(() => useStats());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.stats).toEqual(mockStatsOverview);
      expect(result.current.streak).toBeNull();
    });
  });

  describe("loading states", () => {
    test("should be loading while either query is loading", async () => {
      let resolveStats: (value: any) => void;
      const statsPromise = new Promise((resolve) => {
        resolveStats = resolve;
      });

      global.fetch = mock((url: string) => {
        if (url === "/api/stats/overview") {
          return statsPromise;
        }
        if (url === "/api/streaks") {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockStreakData),
          } as Response);
        }
        return Promise.reject(new Error("Unknown URL"));
      }) as any;

      const { result } = renderHook(() => useStats());

      // Should be loading initially
      expect(result.current.isLoading).toBe(true);

      // Resolve stats
      resolveStats!({
        ok: true,
        json: () => Promise.resolve(mockStatsOverview),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.stats).toEqual(mockStatsOverview);
      expect(result.current.streak).toEqual(mockStreakData);
    });

    test("should not be loading when both queries complete", async () => {
      const { result } = renderHook(() => useStats());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.stats).toEqual(mockStatsOverview);
      expect(result.current.streak).toEqual(mockStreakData);
    });
  });

  describe("error handling", () => {
    test("should handle stats fetch error", async () => {
      global.fetch = mock((url: string) => {
        if (url === "/api/stats/overview") {
          return Promise.reject(new Error("Stats error"));
        }
        if (url === "/api/streaks") {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockStreakData),
          } as Response);
        }
        return Promise.reject(new Error("Unknown URL"));
      }) as any;

      const { result } = renderHook(() => useStats());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.stats).toBeNull();
    });

    test("should handle streak fetch error", async () => {
      global.fetch = mock((url: string) => {
        if (url === "/api/stats/overview") {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockStatsOverview),
          } as Response);
        }
        if (url === "/api/streaks") {
          return Promise.reject(new Error("Streak error"));
        }
        return Promise.reject(new Error("Unknown URL"));
      }) as any;

      const { result } = renderHook(() => useStats());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.streak).toBeNull();
    });

    test("should handle both queries failing", async () => {
      global.fetch = mock(() =>
        Promise.reject(new Error("Network error"))
      ) as any;

      const { result } = renderHook(() => useStats());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.stats).toBeNull();
      expect(result.current.streak).toBeNull();
    });

    test("should handle non-ok responses", async () => {
      global.fetch = mock((url: string) => {
        return Promise.resolve({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ error: "Server error" }),
        } as Response);
      }) as any;

      const { result } = renderHook(() => useStats());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
    });
  });

  describe("query configuration", () => {
    test("should fetch with no-store cache directive", async () => {
      const { result } = renderHook(() => useStats());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(global.fetch).toHaveBeenCalledWith("/api/stats/overview", {
        cache: "no-store",
      });
      expect(global.fetch).toHaveBeenCalledWith("/api/streaks", {
        cache: "no-store",
      });
    });
  });

  describe("default values", () => {
    test("should return null for undefined data", async () => {
      global.fetch = mock((url: string) => {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(undefined),
        } as Response);
      }) as any;

      const { result } = renderHook(() => useStats());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.stats).toBeNull();
      expect(result.current.streak).toBeNull();
    });
  });
});
