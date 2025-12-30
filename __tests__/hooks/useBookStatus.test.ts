import { test, expect, describe, beforeEach, afterEach, mock } from "bun:test";
import { renderHook, waitFor, act } from "../test-utils";
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
      id: 1,
      status: "to-read",
    },
  };

  const mockOnStatusChange = mock(() => {});
  const mockOnRefresh = mock(() => {});

  beforeEach(() => {
    global.fetch = mock(() => Promise.resolve({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: () => Promise.resolve({}),
    } as Response)) as any;
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
    test("should show complete book modal when marking as read from to-read", () => {
      const { result } = renderHook(() =>
        useBookStatus(mockBook, [], "123", mockOnStatusChange, mockOnRefresh)
      );

      act(() => {
        result.current.handleUpdateStatus("read");
      });

      expect(result.current.showCompleteBookModal).toBe(true);
      expect(result.current.showReadConfirmation).toBe(false);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    test("should show finish book modal when marking as read from reading", () => {
      const readingBook = {
        ...mockBook,
        activeSession: { id: 1, status: "reading" },
      };

      const { result } = renderHook(() =>
        useBookStatus(readingBook, [], "123", mockOnStatusChange, mockOnRefresh)
      );

      act(() => {
        result.current.handleUpdateStatus("read");
      });

      expect(result.current.showReadConfirmation).toBe(true);
      expect(result.current.showCompleteBookModal).toBe(false);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    test("should show confirmation for backward movement with progress", () => {
      const readingBook = {
        ...mockBook,
        activeSession: { id: 1, status: "reading" },
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
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => Promise.resolve({ sessionArchived: false }),
      } as Response)) as any;

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
            body: expect.stringContaining("read-next"),
          })
        );
      });

      expect(result.current.selectedStatus).toBe("read-next");
      expect(mockOnRefresh).toHaveBeenCalled();
    });

    test("should not show confirmation for backward movement without progress", async () => {
      const readingBook = {
        ...mockBook,
        activeSession: { id: 1, status: "reading" },
      };

      global.fetch = mock(() => Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => Promise.resolve({ sessionArchived: false }),
      } as Response)) as any;

      const { result } = renderHook(() =>
        useBookStatus(readingBook, [], "123", mockOnStatusChange, mockOnRefresh)
      );

      await act(async () => {
        await result.current.handleUpdateStatus("to-read");
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/books/123/status",
          expect.objectContaining({
            method: "POST",
          })
        );
      });

      expect(result.current.showStatusChangeConfirmation).toBe(false);
    });
  });

  describe("handleConfirmStatusChange", () => {
    test("should perform status change and clear pending state", async () => {
      const readingBook = {
        ...mockBook,
        activeSession: { id: 1, status: "reading" },
      };
      const progressEntries = [{ id: 1, currentPage: 50, currentPercentage: 16.7, progressDate: "2024-01-01", notes: "", pagesRead: 50 }];

      global.fetch = mock(() => Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => Promise.resolve({ sessionArchived: true, archivedSessionNumber: 1 }),
      } as Response)) as any;

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
    test("should mark book as read with rating and review when status is 'reading'", async () => {
      const readingBook = {
        ...mockBook,
        activeSession: { id: 1, status: "reading" },
      };

      const { result } = renderHook(() =>
        useBookStatus(readingBook, [], "123", mockOnStatusChange, mockOnRefresh)
      );

      await act(async () => {
        await result.current.handleConfirmRead(4, "Great book!");
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/books/123/mark-as-read",
          expect.objectContaining({
            method: "POST",
            body: expect.stringContaining("4"),
          })
        );
      });

      expect(result.current.selectedStatus).toBe("read");
      expect(result.current.showReadConfirmation).toBe(false);
    });

    test("should mark book as read via progress endpoint when not in 'reading' status", async () => {
      let fetchCallCount = 0;
      global.fetch = mock(() => {
        fetchCallCount++;
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: () => Promise.resolve({}),
        } as Response);
      }) as any;

      const { result } = renderHook(() =>
        useBookStatus(mockBook, [], "123", mockOnStatusChange, mockOnRefresh)
      );

      await act(async () => {
        await result.current.handleConfirmRead(4, "Great book!");
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/books/123/mark-as-read",
          expect.objectContaining({
            method: "POST",
            body: expect.stringContaining("4"),
          })
        );
      });

      expect(result.current.selectedStatus).toBe("read");
      expect(result.current.showReadConfirmation).toBe(false);
    });

    test("should handle books without total pages", async () => {
      const bookWithoutPages = {
        ...mockBook,
        totalPages: undefined,
      };

      const { result } = renderHook(() =>
        useBookStatus(bookWithoutPages, [], "123", mockOnStatusChange, mockOnRefresh)
      );

      await act(async () => {
        await result.current.handleConfirmRead(5);
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/books/123/mark-as-read",
          expect.objectContaining({
            method: "POST",
            body: expect.stringContaining("5"),
          })
        );
      });
    });
  });

  describe("handleStartReread", () => {
    test("should start re-reading and refresh data", async () => {
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
      global.fetch = mock(() => Promise.reject(new Error("Cannot reread"))) as any;

      const { result} = renderHook(() =>
        useBookStatus(mockBook, [], "123", mockOnStatusChange, mockOnRefresh)
      );

      // Expect the mutation to throw (after retries - 1s + 2s + 4s = 7s with exponential backoff)
      await act(async () => {
        await expect(result.current.handleStartReread()).rejects.toThrow();
      });
    }, { timeout: 10000 }); // Increase timeout to account for retry logic (3 retries with backoff)
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
        activeSession: { id: 1, status: "reading" },
      };

      rerender({ book: updatedBook });

      expect(result.current.selectedStatus).toBe("reading");
    });
  });
});
