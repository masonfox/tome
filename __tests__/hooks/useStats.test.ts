import { test, expect, describe, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from "../test-utils";
import { useStats } from "@/hooks/useStats";
import { statsApi } from "@/lib/api";

// Mock the statsApi module
vi.mock("@/lib/api", () => ({
  statsApi: {
    getOverview: vi.fn(),
    getStreak: vi.fn(),
  },
}));

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
    vi.clearAllMocks();
    vi.mocked(statsApi.getOverview).mockResolvedValue(mockStatsOverview);
    vi.mocked(statsApi.getStreak).mockResolvedValue(mockStreakData);
  });

  afterEach(() => {
    vi.clearAllMocks();
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

      expect(statsApi.getOverview).toHaveBeenCalledTimes(1);
      expect(statsApi.getStreak).toHaveBeenCalledTimes(1);
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
      vi.mocked(statsApi.getOverview).mockResolvedValue(null as any);

      const { result } = renderHook(() => useStats());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.stats).toBeNull();
      expect(result.current.streak).toEqual(mockStreakData);
    });

    test("should handle null streak", async () => {
      vi.mocked(statsApi.getStreak).mockResolvedValue(null as any);

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

      vi.mocked(statsApi.getOverview).mockReturnValue(statsPromise as any);

      const { result } = renderHook(() => useStats());

      // Should be loading initially
      expect(result.current.isLoading).toBe(true);

      // Resolve stats
      resolveStats!(mockStatsOverview);

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
      vi.mocked(statsApi.getOverview).mockRejectedValue(new Error("Stats error"));

      const { result } = renderHook(() => useStats());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.stats).toBeNull();
    });

    test("should handle streak fetch error", async () => {
      vi.mocked(statsApi.getStreak).mockRejectedValue(new Error("Streak error"));

      const { result } = renderHook(() => useStats());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.streak).toBeNull();
    });

    test("should handle both queries failing", async () => {
      vi.mocked(statsApi.getOverview).mockRejectedValue(new Error("Network error"));
      vi.mocked(statsApi.getStreak).mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useStats());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.stats).toBeNull();
      expect(result.current.streak).toBeNull();
    });

    test("should handle API errors", async () => {
      vi.mocked(statsApi.getOverview).mockRejectedValue(new Error("Server error"));
      vi.mocked(statsApi.getStreak).mockRejectedValue(new Error("Server error"));

      const { result } = renderHook(() => useStats());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
    });
  });

  describe("query configuration", () => {
    test("should call both API methods", async () => {
      const { result } = renderHook(() => useStats());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(statsApi.getOverview).toHaveBeenCalledTimes(1);
      expect(statsApi.getStreak).toHaveBeenCalledTimes(1);
    });
  });

  describe("default values", () => {
    test("should return null for undefined data", async () => {
      vi.mocked(statsApi.getOverview).mockResolvedValue(undefined as any);
      vi.mocked(statsApi.getStreak).mockResolvedValue(undefined as any);

      const { result } = renderHook(() => useStats());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.stats).toBeNull();
      expect(result.current.streak).toBeNull();
    });
  });
});
