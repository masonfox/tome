import { test, expect, describe, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor, act } from "../test-utils";
import { useBookProgress } from "@/hooks/useBookProgress";
import type { Book } from "@/hooks/useBookDetail";
import { getTodayLocalDate } from '@/utils/dateHelpers';
import { bookApi } from "@/lib/api";

// Mock the bookApi module
vi.mock("@/lib/api", () => ({
  bookApi: {
    listProgress: vi.fn(),
    createProgress: vi.fn(),
    updateProgress: vi.fn(),
    deleteProgress: vi.fn(),
  },
}));

const originalLocalStorage = global.localStorage;

describe("useBookProgress", () => {
  const mockBook: Book = {
    id: 123,
    calibreId: 1,
    title: "Test Book",
    authors: ["Test Author"],
    tags: [],
    totalPages: 300,
    activeSession: {
      id: 1,
      status: "reading",
      startedDate: "2024-01-01",
    },
    latestProgress: {
      currentPage: 50,
      currentPercentage: 16.67,
      progressDate: "2024-01-01",
    },
  };

  const mockProgressEntries = [
    { id: 1, bookId: 123, sessionId: 1, currentPage: 30, currentPercentage: 10, progressDate: "2024-01-01", pagesRead: 30, notes: "Day 1" },
    { id: 2, bookId: 123, sessionId: 1, currentPage: 50, currentPercentage: 16.67, progressDate: "2024-01-02", pagesRead: 20, notes: "" },
  ];

  const mockOnRefresh = vi.fn(() => {});

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Setup default mock implementations
    vi.mocked(bookApi.listProgress).mockResolvedValue(mockProgressEntries);
    vi.mocked(bookApi.createProgress).mockResolvedValue({
      progressLog: mockProgressEntries[0],
      shouldShowCompletionModal: false,
    });
    vi.mocked(bookApi.updateProgress).mockResolvedValue({
      progressLog: mockProgressEntries[0],
    });
    vi.mocked(bookApi.deleteProgress).mockResolvedValue({
      success: true,
    });

    // Mock localStorage
    const storage: { [key: string]: string } = {};
    global.localStorage = {
      getItem: (key: string) => storage[key] || null,
      setItem: (key: string, value: string) => { storage[key] = value; },
      removeItem: (key: string) => { delete storage[key]; },
      clear: () => { Object.keys(storage).forEach(k => delete storage[k]); },
      length: 0,
      key: () => null,
    } as Storage;

    mockOnRefresh.mockClear();
  });

  afterEach(() => {
    global.localStorage = originalLocalStorage;
  });

  describe("initialization", () => {
    test("should fetch progress entries on mount", async () => {
      const { result } = renderHook(() => useBookProgress("123", mockBook, mockOnRefresh));

      await waitFor(() => {
        expect(result.current.progress.length).toBe(2);
      });

      expect(bookApi.listProgress).toHaveBeenCalledWith("123");
    });

    test("should initialize with latest progress values", async () => {
      const { result } = renderHook(() => useBookProgress("123", mockBook, mockOnRefresh));

      await waitFor(() => {
        expect(result.current.currentPage).toBe("50");
        expect(result.current.currentPercentage).toBe("16.67");
      });
    });

    test("should load saved progress input mode from localStorage", async () => {
      localStorage.setItem("progressInputMode", "percentage");

      const { result } = renderHook(() => useBookProgress("123", mockBook, mockOnRefresh));

      expect(result.current.progressInputMode).toBe("percentage");
    });

    test("should default to page mode if no saved preference", async () => {
      const { result } = renderHook(() => useBookProgress("123", mockBook, mockOnRefresh));

      expect(result.current.progressInputMode).toBe("page");
    });

    test("should set progress date to today for reading books", async () => {
      const readingBook = {
        ...mockBook,
        activeSession: { 
          id: 1,
          status: "reading",
          startedDate: "2024-01-01",
        },
      };

      const { result } = renderHook(() => useBookProgress("123", readingBook, mockOnRefresh));

      const today = getTodayLocalDate();
      expect(result.current.progressDate).toBe(today);
    });
  });

  describe("progressInputMode", () => {
    test("should switch to percentage mode and save to localStorage", async () => {
      const { result } = renderHook(() => useBookProgress("123", mockBook, mockOnRefresh));

      act(() => {
        result.current.setProgressInputMode("percentage");
      });

      expect(result.current.progressInputMode).toBe("percentage");
      expect(localStorage.getItem("progressInputMode")).toBe("percentage");
    });

    test("should update current values when switching modes", async () => {
      const { result } = renderHook(() => useBookProgress("123", mockBook, mockOnRefresh));

      // Start in page mode
      expect(result.current.currentPage).toBe("50");

      // Switch to percentage mode
      act(() => {
        result.current.setProgressInputMode("percentage");
      });

      expect(result.current.currentPercentage).toBe("16.67");
    });
  });

  describe("handleLogProgress", () => {
    test("should log progress with page number", async () => {
      vi.mocked(bookApi.createProgress).mockResolvedValue({
        progressLog: {
          id: 3,
          bookId: 123,
          sessionId: 1,
          currentPage: 100,
          currentPercentage: 33.33,
          progressDate: "2024-01-03",
          pagesRead: 50,
        },
        shouldShowCompletionModal: false,
      });

      const { result } = renderHook(() => useBookProgress("123", mockBook, mockOnRefresh));

      act(() => {
        result.current.setCurrentPage("100");
        result.current.setNotes("Halfway through!");
      });

      await act(async () => {
        await result.current.handleLogProgress({ preventDefault: () => {} } as any);
      });

      await waitFor(() => {
        expect(bookApi.createProgress).toHaveBeenCalledWith(
          "123",
          expect.objectContaining({
            currentPage: 100,
            notes: "Halfway through!",
          })
        );
      });

      expect(result.current.notes).toBe(""); // Should reset after success
      expect(mockOnRefresh).toHaveBeenCalled();
    });

    test("should log progress with percentage", async () => {
      vi.mocked(bookApi.createProgress).mockResolvedValue({
        progressLog: {
          id: 3,
          bookId: 123,
          sessionId: 1,
          currentPage: 150,
          currentPercentage: 50,
          progressDate: "2024-01-03",
          pagesRead: 100,
        },
        shouldShowCompletionModal: false,
      });

      const { result } = renderHook(() => useBookProgress("123", mockBook, mockOnRefresh));

      act(() => {
        result.current.setProgressInputMode("percentage");
        result.current.setCurrentPercentage("50");
      });

      await act(async () => {
        await result.current.handleLogProgress({ preventDefault: () => {} } as any);
      });

      await waitFor(() => {
        expect(bookApi.createProgress).toHaveBeenCalledWith(
          "123",
          expect.objectContaining({
            currentPercentage: 50,
          })
        );
      });
    });

    test("should validate page is greater than latest progress", async () => {
      const { result } = renderHook(() => useBookProgress("123", mockBook, mockOnRefresh));

      act(() => {
        result.current.setCurrentPage("40"); // Less than current 50
      });

      await act(async () => {
        await result.current.handleLogProgress({ preventDefault: () => {} } as any);
      });

      // Should not call API
      expect(bookApi.createProgress).not.toHaveBeenCalled();
    });

    test("should include progress date in payload if provided", async () => {
      vi.mocked(bookApi.createProgress).mockResolvedValue({
        progressLog: {
          id: 3,
          bookId: 123,
          sessionId: 1,
          currentPage: 100,
          currentPercentage: 33.33,
          progressDate: "2024-01-15",
          pagesRead: 50,
        },
        shouldShowCompletionModal: false,
      });

      const { result } = renderHook(() => useBookProgress("123", mockBook, mockOnRefresh));

      act(() => {
        result.current.setCurrentPage("100");
        result.current.setProgressDate("2024-01-15");
      });

      await act(async () => {
        await result.current.handleLogProgress({ preventDefault: () => {} } as any);
      });

      await waitFor(() => {
        expect(bookApi.createProgress).toHaveBeenCalledWith(
          "123",
          expect.objectContaining({
            currentPage: 100,
            progressDate: expect.stringContaining("2024-01-15"),
          })
        );
      });
    });

    test("should handle API errors gracefully", async () => {
      const consoleErrorSpy = vi.fn(console.error);
      console.error = consoleErrorSpy;

      vi.mocked(bookApi.createProgress).mockRejectedValue(new Error("Temporal validation failed"));

      const { result } = renderHook(() => useBookProgress("123", mockBook, mockOnRefresh));

      act(() => {
        result.current.setCurrentPage("100");
      });

      await act(async () => {
        await result.current.handleLogProgress({ preventDefault: () => {} } as any);
      });

      expect(consoleErrorSpy).not.toHaveBeenCalled(); // Error displayed via toast
    });
  });

  describe("handleEditProgress", () => {
    test("should open edit modal with selected entry", () => {
      const { result } = renderHook(() => useBookProgress("123", mockBook, mockOnRefresh));

      act(() => {
        result.current.handleEditProgress(mockProgressEntries[0]);
      });

      expect(result.current.showEditProgressModal).toBe(true);
      expect(result.current.selectedProgressEntry).toEqual(mockProgressEntries[0]);
    });
  });

  describe("handleConfirmEditProgress", () => {
    test("should update progress entry", async () => {
      vi.mocked(bookApi.updateProgress).mockResolvedValue({
        progressLog: {
          ...mockProgressEntries[0],
          currentPage: 35,
          currentPercentage: 11.67,
          notes: "Updated notes",
        },
      });

      const { result } = renderHook(() => useBookProgress("123", mockBook, mockOnRefresh));

      // Open edit modal
      act(() => {
        result.current.handleEditProgress(mockProgressEntries[0]);
      });

      // Confirm edit
      await act(async () => {
        await result.current.handleConfirmEditProgress({
          currentPage: 35,
          currentPercentage: 11.67,
          progressDate: "2024-01-01",
          notes: "Updated notes",
        });
      });

      await waitFor(() => {
        expect(bookApi.updateProgress).toHaveBeenCalledWith(
          "123",
          1,
          {
            currentPage: 35,
            currentPercentage: 11.67,
            progressDate: "2024-01-01",
            notes: "Updated notes",
          }
        );
      });

      expect(result.current.showEditProgressModal).toBe(false);
      expect(result.current.selectedProgressEntry).toBeNull();
      expect(mockOnRefresh).toHaveBeenCalled();
    });
  });

  describe("handleDeleteProgress", () => {
    test("should delete progress entry", async () => {
      vi.mocked(bookApi.deleteProgress).mockResolvedValue({
        success: true,
      });

      const { result } = renderHook(() => useBookProgress("123", mockBook, mockOnRefresh));

      // Select entry for deletion
      act(() => {
        result.current.handleEditProgress(mockProgressEntries[0]);
      });

      // Delete
      await act(async () => {
        await result.current.handleDeleteProgress();
      });

      await waitFor(() => {
        expect(bookApi.deleteProgress).toHaveBeenCalledWith("123", 1);
      });

      expect(result.current.showEditProgressModal).toBe(false);
      expect(mockOnRefresh).toHaveBeenCalled();
    });

    test("should not delete if no entry selected", async () => {
      const { result } = renderHook(() => useBookProgress("123", mockBook, mockOnRefresh));

      await act(async () => {
        await result.current.handleDeleteProgress();
      });

      expect(bookApi.deleteProgress).not.toHaveBeenCalled();
    });
  });

  describe("unsaved changes tracking", () => {
    test("should track unsaved changes when form is modified", async () => {
      const { result } = renderHook(() => useBookProgress("123", mockBook, mockOnRefresh));

      await waitFor(() => {
        expect(result.current.hasUnsavedProgress).toBe(false);
      });

      act(() => {
        result.current.setCurrentPage("100");
      });

      await waitFor(() => {
        expect(result.current.hasUnsavedProgress).toBe(true);
      });
    });

    test("should not mark as unsaved if value matches latest progress", async () => {
      const { result } = renderHook(() => useBookProgress("123", mockBook, mockOnRefresh));

      act(() => {
        result.current.setCurrentPage("50"); // Same as latest
      });

      await waitFor(() => {
        expect(result.current.hasUnsavedProgress).toBe(false);
      });
    });

    test("should clear unsaved flag after successful submission", async () => {
      vi.mocked(bookApi.createProgress).mockResolvedValue({
        progressLog: {
          id: 3,
          bookId: 123,
          sessionId: 1,
          currentPage: 100,
          currentPercentage: 33.33,
          progressDate: "2024-01-03",
          pagesRead: 50,
        },
        shouldShowCompletionModal: false,
      });

      const { result } = renderHook(() => useBookProgress("123", mockBook, mockOnRefresh));

      act(() => {
        result.current.setCurrentPage("100");
      });

      await waitFor(() => {
        expect(result.current.hasUnsavedProgress).toBe(true);
      });

      await act(async () => {
        await result.current.handleLogProgress({ preventDefault: () => {} } as any);
      });

      await waitFor(() => {
        expect(result.current.hasUnsavedProgress).toBe(false);
      });
    });
  });

  describe("refetchProgress", () => {
    test("should refetch progress entries", async () => {
      const updatedProgress = [
        ...mockProgressEntries,
        { id: 3, bookId: 123, sessionId: 1, currentPage: 100, currentPercentage: 33.33, progressDate: "2024-01-03", pagesRead: 50, notes: "" },
      ];

      let callCount = 0;
      vi.mocked(bookApi.listProgress).mockImplementation(() => {
        callCount++;
        return Promise.resolve(callCount === 1 ? mockProgressEntries : updatedProgress);
      });

      const { result } = renderHook(() => useBookProgress("123", mockBook, mockOnRefresh));

      await waitFor(() => {
        expect(result.current.progress.length).toBe(2);
      });

      await act(async () => {
        await result.current.refetchProgress();
      });

      await waitFor(() => {
        expect(result.current.progress.length).toBe(3);
      });
    });
  });
});
