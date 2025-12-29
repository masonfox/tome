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
        expect(global.fetch).toHaveBeenCalled();
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
        useBookStatus(readingBook, [], "123", mockOnStatusChange, mockOnRefresh)
      );

      await act(async () => {
        await result.current.handleConfirmRead(4, "Great book!");
      });

      await waitFor(() => {
        expect(fetchCallCount).toBe(3); // progress (auto-completes) + rating + session review
      });

      // Check progress was set to 100% (this auto-completes the book via progress service)
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/books/123/progress",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("100"),
        })
      );

      // Check rating was updated via the rating endpoint
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/books/123/rating",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ rating: 4 }),
        })
      );

      // Check review was updated via the session endpoint
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/books/123/sessions/1",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ review: "Great book!" }),
        })
      );

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
        expect(fetchCallCount).toBe(4); // transition to reading + progress (auto-completes) + rating + session review
      });

      // Should transition to "reading" first
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/books/123/status",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ status: "reading" }),
        })
      );

      // Then create 100% progress (which auto-completes to "read")
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/books/123/progress",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("100"),
        })
      );

      // Then update rating
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/books/123/rating",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ rating: 4 }),
        })
      );

      // Check review was updated via the session endpoint
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/books/123/sessions/1",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ review: "Great book!" }),
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
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => Promise.resolve({}),
      } as Response)) as any;

      const { result } = renderHook(() =>
        useBookStatus(bookWithoutPages, [], "123", mockOnStatusChange, mockOnRefresh)
      );

      await act(async () => {
        await result.current.handleConfirmRead(5);
      });

      await waitFor(() => {
        // Should call status endpoint + rating endpoint (no progress)
        expect(global.fetch).toHaveBeenCalledTimes(2);
      });

      expect(global.fetch).toHaveBeenCalledWith(
        "/api/books/123/status",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ status: "read" }),
        })
      );

      expect(global.fetch).toHaveBeenCalledWith(
        "/api/books/123/rating",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ rating: 5 }),
        })
      );
    });
  });

  describe("handleStartReread", () => {
    test("should start re-reading and refresh data", async () => {
      global.fetch = mock(() => Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => Promise.resolve({}),
      } as Response)) as any;

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
      global.fetch = mock(() => Promise.resolve({
        ok: false,
        status: 400,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => Promise.resolve({ error: "Cannot reread" }),
      } as Response)) as any;

      const { result } = renderHook(() =>
        useBookStatus(mockBook, [], "123", mockOnStatusChange, mockOnRefresh)
      );

      // Expect the mutation to throw
      await act(async () => {
        await expect(result.current.handleStartReread()).rejects.toThrow("Cannot reread");
      });
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
        activeSession: { id: 1, status: "reading" },
      };

      rerender({ book: updatedBook });

      expect(result.current.selectedStatus).toBe("reading");
    });
  });
});
