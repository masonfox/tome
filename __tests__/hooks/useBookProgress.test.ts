import { test, expect, describe, beforeEach, afterEach, mock } from "bun:test";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useBookProgress } from "@/hooks/useBookProgress";
import type { Book } from "@/hooks/useBookDetail";
import { getTodayLocalDate } from "@/utils/dateFormatting";

const originalFetch = global.fetch;
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
    { id: 1, currentPage: 30, currentPercentage: 10, progressDate: "2024-01-01", pagesRead: 30, notes: "Day 1" },
    { id: 2, currentPage: 50, currentPercentage: 16.67, progressDate: "2024-01-02", pagesRead: 20, notes: "" },
  ];

  const mockOnRefresh = mock(() => {});

  beforeEach(() => {
    global.fetch = mock(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve(mockProgressEntries),
    } as Response));

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
    global.fetch = originalFetch;
    global.localStorage = originalLocalStorage;
  });

  describe("initialization", () => {
    test("should fetch progress entries on mount", async () => {
      const { result } = renderHook(() => useBookProgress("123", mockBook, mockOnRefresh));

      await waitFor(() => {
        expect(result.current.progress.length).toBe(2);
      });

      expect(global.fetch).toHaveBeenCalledWith("/api/books/123/progress");
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
        activeSession: { status: "reading" },
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
      global.fetch = mock(() => Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          id: 3,
          currentPage: 100,
          currentPercentage: 33.33,
          progressDate: "2024-01-03",
        }),
      } as Response));

      const { result } = renderHook(() => useBookProgress("123", mockBook, mockOnRefresh));

      act(() => {
        result.current.setCurrentPage("100");
        result.current.setNotes("Halfway through!");
      });

      await act(async () => {
        await result.current.handleLogProgress({ preventDefault: () => {} } as any);
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/books/123/progress",
          expect.objectContaining({
            method: "POST",
            body: expect.stringContaining('"currentPage":100'),
          })
        );
      });

      expect(result.current.notes).toBe(""); // Should reset after success
      expect(mockOnRefresh).toHaveBeenCalled();
    });

    test("should log progress with percentage", async () => {
      global.fetch = mock(() => Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          id: 3,
          currentPage: 150,
          currentPercentage: 50,
          progressDate: "2024-01-03",
        }),
      } as Response));

      const { result } = renderHook(() => useBookProgress("123", mockBook, mockOnRefresh));

      act(() => {
        result.current.setProgressInputMode("percentage");
        result.current.setCurrentPercentage("50");
      });

      await act(async () => {
        await result.current.handleLogProgress({ preventDefault: () => {} } as any);
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/books/123/progress",
          expect.objectContaining({
            method: "POST",
            body: expect.stringContaining('"currentPercentage":50'),
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
      expect(global.fetch).not.toHaveBeenCalledWith(
        "/api/books/123/progress",
        expect.objectContaining({ method: "POST" })
      );
    });

    test("should include progress date in payload if provided", async () => {
      global.fetch = mock(() => Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          id: 3,
          currentPage: 100,
          currentPercentage: 33.33,
          progressDate: "2024-01-15",
        }),
      } as Response));

      const { result } = renderHook(() => useBookProgress("123", mockBook, mockOnRefresh));

      act(() => {
        result.current.setCurrentPage("100");
        result.current.setProgressDate("2024-01-15");
      });

      await act(async () => {
        await result.current.handleLogProgress({ preventDefault: () => {} } as any);
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/books/123/progress",
          expect.objectContaining({
            method: "POST",
            body: expect.stringContaining("2024-01-15"),
          })
        );
      });
    });

    test("should handle API errors gracefully", async () => {
      const consoleErrorSpy = mock(console.error);
      console.error = consoleErrorSpy;

      global.fetch = mock(() => Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ error: "Temporal validation failed" }),
      } as Response));

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
      global.fetch = mock(() => Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      } as Response));

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
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/books/123/progress/1",
          expect.objectContaining({
            method: "PATCH",
            body: expect.stringContaining('"currentPage":35'),
          })
        );
      });

      expect(result.current.showEditProgressModal).toBe(false);
      expect(result.current.selectedProgressEntry).toBeNull();
      expect(mockOnRefresh).toHaveBeenCalled();
    });
  });

  describe("handleDeleteProgress", () => {
    test("should delete progress entry", async () => {
      global.fetch = mock(() => Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      } as Response));

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
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/books/123/progress/1",
          expect.objectContaining({ method: "DELETE" })
        );
      });

      expect(result.current.showEditProgressModal).toBe(false);
      expect(mockOnRefresh).toHaveBeenCalled();
    });

    test("should not delete if no entry selected", async () => {
      const { result } = renderHook(() => useBookProgress("123", mockBook, mockOnRefresh));

      await act(async () => {
        await result.current.handleDeleteProgress();
      });

      expect(global.fetch).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ method: "DELETE" })
      );
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
      global.fetch = mock(() => Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          id: 3,
          currentPage: 100,
          currentPercentage: 33.33,
          progressDate: "2024-01-03",
        }),
      } as Response));

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
        { id: 3, currentPage: 100, currentPercentage: 33.33, progressDate: "2024-01-03", pagesRead: 50, notes: "" },
      ];

      let callCount = 0;
      global.fetch = mock(() => {
        callCount++;
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(callCount === 1 ? mockProgressEntries : updatedProgress),
        } as Response);
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
