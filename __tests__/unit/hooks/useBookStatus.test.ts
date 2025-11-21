import { test, expect, describe, beforeEach, afterEach, mock } from "bun:test";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useBookStatus } from "@/hooks/useBookStatus";
import type { Book } from "@/hooks/useBookDetail";

const originalFetch = global.fetch;

describe("useBookStatus", () => {
  const mockBook: Book = {
    id: 123,
    calibreId: 1,
    title: "Test Book",
    authors: ["Test Author"],
    tags: [],
    totalPages: 300,
    activeSession: {
      status: "to-read",
    },
  };

  const mockOnStatusChange = mock(() => {});
  const mockOnRefresh = mock(() => {});

  beforeEach(() => {
    global.fetch = mock(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({}),
    } as Response));
    mockOnStatusChange.mockClear();
    mockOnRefresh.mockClear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("initialization", () => {
    test("should initialize with book's active session status", () => {
      const { result } = renderHook(() =>
        useBookStatus(mockBook, [], "123", mockOnStatusChange, mockOnRefresh)
      );

      expect(result.current.selectedStatus).toBe("to-read");
      expect(result.current.showReadConfirmation).toBe(false);
      expect(result.current.showStatusChangeConfirmation).toBe(false);
      expect(result.current.pendingStatusChange).toBeNull();
    });

    test("should default to 'read' for completed books without active session", () => {
      const completedBook = {
        ...mockBook,
        hasCompletedReads: true,
        activeSession: undefined,
      };

      const { result } = renderHook(() =>
        useBookStatus(completedBook, [], "123", mockOnStatusChange, mockOnRefresh)
      );

      expect(result.current.selectedStatus).toBe("read");
    });
  });

  describe("handleUpdateStatus", () => {
    test("should show read confirmation when marking as read", () => {
      const { result } = renderHook(() =>
        useBookStatus(mockBook, [], "123", mockOnStatusChange, mockOnRefresh)
      );

      act(() => {
        result.current.handleUpdateStatus("read");
      });

      expect(result.current.showReadConfirmation).toBe(true);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    test("should show confirmation for backward movement with progress", () => {
      const readingBook = {
        ...mockBook,
        activeSession: { status: "reading" },
      };
      const progressEntries = [{ id: 1, currentPage: 50, currentPercentage: 16.7, progressDate: "2024-01-01", notes: "", pagesRead: 50 }];

      const { result } = renderHook(() =>
        useBookStatus(readingBook, progressEntries, "123", mockOnStatusChange, mockOnRefresh)
      );

      act(() => {
        result.current.handleUpdateStatus("to-read");
      });

      expect(result.current.showStatusChangeConfirmation).toBe(true);
      expect(result.current.pendingStatusChange).toBe("to-read");
      expect(global.fetch).not.toHaveBeenCalled();
    });

    test("should update status directly for forward movement", async () => {
      global.fetch = mock(() => Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ sessionArchived: false }),
      } as Response));

      const { result } = renderHook(() =>
        useBookStatus(mockBook, [], "123", mockOnStatusChange, mockOnRefresh)
      );

      await act(async () => {
        await result.current.handleUpdateStatus("read-next");
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/books/123/status",
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify({ status: "read-next" }),
          })
        );
      });

      expect(result.current.selectedStatus).toBe("read-next");
      expect(mockOnRefresh).toHaveBeenCalled();
    });

    test("should not show confirmation for backward movement without progress", async () => {
      const readingBook = {
        ...mockBook,
        activeSession: { status: "reading" },
      };

      global.fetch = mock(() => Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ sessionArchived: false }),
      } as Response));

      const { result } = renderHook(() =>
        useBookStatus(readingBook, [], "123", mockOnStatusChange, mockOnRefresh)
      );

      await act(async () => {
        await result.current.handleUpdateStatus("to-read");
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      expect(result.current.showStatusChangeConfirmation).toBe(false);
    });
  });

  describe("handleConfirmStatusChange", () => {
    test("should perform status change and clear pending state", async () => {
      const readingBook = {
        ...mockBook,
        activeSession: { status: "reading" },
      };
      const progressEntries = [{ id: 1, currentPage: 50, currentPercentage: 16.7, progressDate: "2024-01-01", notes: "", pagesRead: 50 }];

      global.fetch = mock(() => Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ sessionArchived: true, archivedSessionNumber: 1 }),
      } as Response));

      const { result } = renderHook(() =>
        useBookStatus(readingBook, progressEntries, "123", mockOnStatusChange, mockOnRefresh)
      );

      // Trigger backward movement
      act(() => {
        result.current.handleUpdateStatus("to-read");
      });

      expect(result.current.pendingStatusChange).toBe("to-read");

      // Confirm
      await act(async () => {
        await result.current.handleConfirmStatusChange();
      });

      await waitFor(() => {
        expect(result.current.showStatusChangeConfirmation).toBe(false);
        expect(result.current.pendingStatusChange).toBeNull();
        expect(result.current.selectedStatus).toBe("to-read");
      });
    });
  });

  describe("handleCancelStatusChange", () => {
    test("should cancel pending status change", () => {
      const { result } = renderHook(() =>
        useBookStatus(mockBook, [], "123", mockOnStatusChange, mockOnRefresh)
      );

      // Set up pending change
      act(() => {
        result.current.handleUpdateStatus("read");
      });

      // Cancel
      act(() => {
        result.current.handleCancelStatusChange();
      });

      expect(result.current.showStatusChangeConfirmation).toBe(false);
      expect(result.current.showReadConfirmation).toBe(false);
      expect(result.current.pendingStatusChange).toBeNull();
    });
  });

  describe("handleConfirmRead", () => {
    test("should mark book as read with rating and review", async () => {
      let fetchCallCount = 0;
      global.fetch = mock(() => {
        fetchCallCount++;
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        } as Response);
      });

      const { result } = renderHook(() =>
        useBookStatus(mockBook, [], "123", mockOnStatusChange, mockOnRefresh)
      );

      await act(async () => {
        await result.current.handleConfirmRead(4, "Great book!");
      });

      await waitFor(() => {
        expect(fetchCallCount).toBe(2); // progress + status
      });

      // Check progress was set to 100%
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/books/123/progress",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("100"),
        })
      );

      // Check status was updated with rating and review
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/books/123/status",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            status: "read",
            rating: 4,
            review: "Great book!",
          }),
        })
      );

      expect(result.current.selectedStatus).toBe("read");
      expect(result.current.showReadConfirmation).toBe(false);
    });

    test("should skip progress update if book has no total pages", async () => {
      const bookWithoutPages = {
        ...mockBook,
        totalPages: undefined,
      };

      global.fetch = mock(() => Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      } as Response));

      const { result } = renderHook(() =>
        useBookStatus(bookWithoutPages, [], "123", mockOnStatusChange, mockOnRefresh)
      );

      await act(async () => {
        await result.current.handleConfirmRead(5);
      });

      await waitFor(() => {
        // Should only call status endpoint, not progress
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });

      expect(global.fetch).toHaveBeenCalledWith(
        "/api/books/123/status",
        expect.anything()
      );
    });
  });

  describe("handleStartReread", () => {
    test("should start re-reading and refresh data", async () => {
      global.fetch = mock(() => Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      } as Response));

      const { result } = renderHook(() =>
        useBookStatus(mockBook, [], "123", mockOnStatusChange, mockOnRefresh)
      );

      await act(async () => {
        await result.current.handleStartReread();
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/books/123/reread",
          expect.objectContaining({
            method: "POST",
          })
        );
      });

      expect(mockOnRefresh).toHaveBeenCalled();
    });

    test("should handle reread errors", async () => {
      const consoleErrorSpy = mock(console.error);
      console.error = consoleErrorSpy;

      global.fetch = mock(() => Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ error: "Cannot reread" }),
      } as Response));

      const { result } = renderHook(() =>
        useBookStatus(mockBook, [], "123", mockOnStatusChange, mockOnRefresh)
      );

      await act(async () => {
        await result.current.handleStartReread();
      });

      await waitFor(() => {
        expect(consoleErrorSpy).not.toHaveBeenCalled(); // No throw, just toast
      });

      console.error = console.error;
    });
  });

  describe("status changes based on book updates", () => {
    test("should update status when book changes", () => {
      const { result, rerender } = renderHook(
        ({ book }) => useBookStatus(book, [], "123", mockOnStatusChange, mockOnRefresh),
        { initialProps: { book: mockBook } }
      );

      expect(result.current.selectedStatus).toBe("to-read");

      const updatedBook = {
        ...mockBook,
        activeSession: { status: "reading" },
      };

      rerender({ book: updatedBook });

      expect(result.current.selectedStatus).toBe("reading");
    });
  });
});
