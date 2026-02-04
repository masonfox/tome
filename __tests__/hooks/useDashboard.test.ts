import { test, expect, describe, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from "../test-utils";
import { useDashboard } from "@/hooks/useDashboard";
import type { DashboardData } from "@/hooks/useDashboard";
import { dashboardApi } from "@/lib/api";

// Mock the dashboardApi module
vi.mock("@/lib/api", () => ({
  dashboardApi: {
    get: vi.fn(),
  },
}));

describe("useDashboard", () => {
  const mockDashboardData: DashboardData = {
    stats: {
      booksRead: {
        thisYear: 10,
        total: 25,
      },
      currentlyReading: 3,
      pagesRead: {
        today: 50,
        thisMonth: 1500,
      },
      avgPagesPerDay: 45,
    },
    streak: {
      currentStreak: 7,
      longestStreak: 15,
      dailyThreshold: 10,
      hoursRemainingToday: 12,
      todayPagesRead: 50,
    },
    currentlyReading: [
      {
        id: 1,
        title: "Book 1",
        authors: ["Author 1"],
        calibreId: 1,
        status: "reading",
        rating: null,
        latestProgress: { currentPage: 100, totalPages: 300 },
      },
    ],
    currentlyReadingTotal: 3,
    readNext: [
      {
        id: 2,
        title: "Book 2",
        authors: ["Author 2"],
        calibreId: 2,
        status: "read-next",
        rating: null,
        latestProgress: null,
      },
    ],
    readNextTotal: 5,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dashboardApi.get).mockResolvedValue(mockDashboardData);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("initialization", () => {
    test("should start with loading state", () => {
      const { result } = renderHook(() => useDashboard());

      expect(result.current.isLoading).toBe(true);
      expect(result.current.stats).toBeNull();
      expect(result.current.streak).toBeNull();
      expect(result.current.currentlyReading).toEqual([]);
      expect(result.current.readNext).toEqual([]);
    });

    test("should fetch dashboard data on mount", async () => {
      const { result } = renderHook(() => useDashboard());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(dashboardApi.get).toHaveBeenCalledTimes(1);
    });
  });

  describe("data fetching", () => {
    test("should return dashboard data after successful fetch", async () => {
      const { result } = renderHook(() => useDashboard());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.stats).toEqual(mockDashboardData.stats);
      expect(result.current.streak).toEqual(mockDashboardData.streak);
      expect(result.current.currentlyReading).toEqual(
        mockDashboardData.currentlyReading
      );
      expect(result.current.currentlyReadingTotal).toBe(3);
      expect(result.current.readNext).toEqual(mockDashboardData.readNext);
      expect(result.current.readNextTotal).toBe(5);
    });

    test("should handle null stats gracefully", async () => {
      vi.mocked(dashboardApi.get).mockResolvedValue({
        ...mockDashboardData,
        stats: null,
      });

      const { result } = renderHook(() => useDashboard());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.stats).toBeNull();
      expect(result.current.streak).toEqual(mockDashboardData.streak);
    });

    test("should handle null streak gracefully", async () => {
      vi.mocked(dashboardApi.get).mockResolvedValue({
        ...mockDashboardData,
        streak: null,
      });

      const { result } = renderHook(() => useDashboard());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.stats).toEqual(mockDashboardData.stats);
      expect(result.current.streak).toBeNull();
    });

    test("should handle empty arrays", async () => {
      vi.mocked(dashboardApi.get).mockResolvedValue({
        ...mockDashboardData,
        currentlyReading: [],
        currentlyReadingTotal: 0,
        readNext: [],
        readNextTotal: 0,
      });

      const { result } = renderHook(() => useDashboard());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.currentlyReading).toEqual([]);
      expect(result.current.currentlyReadingTotal).toBe(0);
      expect(result.current.readNext).toEqual([]);
      expect(result.current.readNextTotal).toBe(0);
    });
  });

  describe("error handling", () => {
    test("should handle fetch errors", async () => {
      vi.mocked(dashboardApi.get).mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useDashboard());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.stats).toBeNull();
      expect(result.current.streak).toBeNull();
    });

    test("should handle API errors", async () => {
      vi.mocked(dashboardApi.get).mockRejectedValue(new Error("Server error"));

      const { result } = renderHook(() => useDashboard());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
    });
  });

  describe("refetch", () => {
    test("should refetch data when refetch is called", async () => {
      let callCount = 0;
      vi.mocked(dashboardApi.get).mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          ...mockDashboardData,
          stats: {
            ...mockDashboardData.stats!,
            booksRead: {
              thisYear: callCount === 1 ? 10 : 15,
              total: 25,
            },
          },
        });
      });

      const { result } = renderHook(() => useDashboard());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.stats?.booksRead.thisYear).toBe(10);

      // Refetch
      await result.current.refetch();

      await waitFor(() => {
        expect(result.current.stats?.booksRead.thisYear).toBe(15);
      });

      expect(callCount).toBe(2);
    });
  });

  describe("query configuration", () => {
    test("should call dashboardApi.get", async () => {
      const { result } = renderHook(() => useDashboard());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Verify API was called
      expect(dashboardApi.get).toHaveBeenCalledTimes(1);
    });
  });

  describe("default values", () => {
    test("should return default values when data is undefined", async () => {
      vi.mocked(dashboardApi.get).mockResolvedValue({} as DashboardData);

      const { result } = renderHook(() => useDashboard());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.stats).toBeNull();
      expect(result.current.streak).toBeNull();
      expect(result.current.currentlyReading).toEqual([]);
      expect(result.current.currentlyReadingTotal).toBe(0);
      expect(result.current.readNext).toEqual([]);
      expect(result.current.readNextTotal).toBe(0);
    });
  });
});

