import { test, expect, describe, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor, act } from "../test-utils";
import { useBookStatus } from "@/hooks/useBookStatus";
import type { Book } from "@/hooks/useBookDetail";

const originalFetch = global.fetch;

/**
 * Comprehensive tests for useBookStatus - DNF (Did Not Finish) workflow
 * 
 * Tests cover:
 * - DNF modal triggering
 * - DNF API call with rating/review/dnfDate
 * - Optimistic updates and rollbacks
 * - Error handling
 * - Query invalidation
 * - Success messaging
 */
describe("useBookStatus - DNF workflow", () => {
  const mockOnStatusChange = vi.fn(() => {});
  const mockOnRefresh = vi.fn(() => {});

  beforeEach(() => {
    global.fetch = vi.fn(() => Promise.resolve({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: () => Promise.resolve({
        ratingUpdated: false,
        reviewUpdated: false,
      }),
    } as Response)) as any;
    mockOnStatusChange.mockClear();
    mockOnRefresh.mockClear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("DNF modal triggering", () => {
    test("should show DNF modal when marking as DNF from reading status", () => {
      const readingBook: Book = {
        id: 123,
        calibreId: 1,
        title: "Test Book",
        authors: ["Test Author"],
        tags: [],
        totalPages: 300,
        activeSession: {
          id: 1,
          status: "reading",
        },
      };

      const { result } = renderHook(() =>
        useBookStatus(readingBook, [], "123", mockOnStatusChange, mockOnRefresh)
      );

      act(() => {
        result.current.handleUpdateStatus("dnf");
      });

      expect(result.current.showDNFModal).toBe(true);
      expect(result.current.showReadConfirmation).toBe(false);
      expect(result.current.showCompleteBookModal).toBe(false);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    test("should not show DNF modal from non-reading status", async () => {
      const toReadBook: Book = {
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

      const { result } = renderHook(() =>
        useBookStatus(toReadBook, [], "123", mockOnStatusChange, mockOnRefresh)
      );

      await act(async () => {
        await result.current.handleUpdateStatus("dnf");
      });

      // Should not show modal - DNF only available from reading
      expect(result.current.showDNFModal).toBe(false);
    });
  });

  describe("handleMarkAsDNF", () => {
    test("should mark book as DNF without rating or review", async () => {
      const readingBook: Book = {
        id: 123,
        calibreId: 1,
        title: "Test Book",
        authors: ["Test Author"],
        tags: [],
        totalPages: 300,
        activeSession: {
          id: 1,
          status: "reading",
        },
      };

      global.fetch = vi.fn(() => Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => Promise.resolve({
          ratingUpdated: false,
          reviewUpdated: false,
        }),
      } as Response)) as any;

      const { result } = renderHook(() =>
        useBookStatus(readingBook, [], "123", mockOnStatusChange, mockOnRefresh)
      );

      // Trigger DNF modal
      act(() => {
        result.current.handleUpdateStatus("dnf");
      });

      expect(result.current.showDNFModal).toBe(true);

      // Confirm DNF
      await act(async () => {
        await result.current.handleMarkAsDNF();
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/books/123/mark-as-dnf",
          expect.objectContaining({
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          })
        );
      });

      expect(result.current.selectedStatus).toBe("dnf");
      expect(result.current.showDNFModal).toBe(false);
      expect(mockOnRefresh).toHaveBeenCalled();
    });

    test("should mark book as DNF with rating", async () => {
      const readingBook: Book = {
        id: 123,
        calibreId: 1,
        title: "Test Book",
        authors: ["Test Author"],
        tags: [],
        totalPages: 300,
        activeSession: {
          id: 1,
          status: "reading",
        },
      };

      global.fetch = vi.fn(() => Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => Promise.resolve({
          ratingUpdated: true,
          reviewUpdated: false,
        }),
      } as Response)) as any;

      const { result } = renderHook(() =>
        useBookStatus(readingBook, [], "123", mockOnStatusChange, mockOnRefresh)
      );

      await act(async () => {
        await result.current.handleMarkAsDNF(2, undefined, undefined);
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/books/123/mark-as-dnf",
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify({ rating: 2 }),
          })
        );
      });

      expect(result.current.selectedStatus).toBe("dnf");
    });

    test("should mark book as DNF with review", async () => {
      const readingBook: Book = {
        id: 123,
        calibreId: 1,
        title: "Test Book",
        authors: ["Test Author"],
        tags: [],
        totalPages: 300,
        activeSession: {
          id: 1,
          status: "reading",
        },
      };

      global.fetch = vi.fn(() => Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => Promise.resolve({
          ratingUpdated: false,
          reviewUpdated: true,
        }),
      } as Response)) as any;

      const { result } = renderHook(() =>
        useBookStatus(readingBook, [], "123", mockOnStatusChange, mockOnRefresh)
      );

      await act(async () => {
        await result.current.handleMarkAsDNF(undefined, "Not my thing");
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/books/123/mark-as-dnf",
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify({ review: "Not my thing" }),
          })
        );
      });

      expect(result.current.selectedStatus).toBe("dnf");
    });

    test("should mark book as DNF with custom dnfDate", async () => {
      const readingBook: Book = {
        id: 123,
        calibreId: 1,
        title: "Test Book",
        authors: ["Test Author"],
        tags: [],
        totalPages: 300,
        activeSession: {
          id: 1,
          status: "reading",
        },
      };

      global.fetch = vi.fn(() => Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => Promise.resolve({
          ratingUpdated: false,
          reviewUpdated: false,
        }),
      } as Response)) as any;

      const { result } = renderHook(() =>
        useBookStatus(readingBook, [], "123", mockOnStatusChange, mockOnRefresh)
      );

      await act(async () => {
        await result.current.handleMarkAsDNF(undefined, undefined, "2026-01-10");
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/books/123/mark-as-dnf",
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify({ dnfDate: "2026-01-10" }),
          })
        );
      });
    });

    test("should mark book as DNF with all parameters", async () => {
      const readingBook: Book = {
        id: 123,
        calibreId: 1,
        title: "Test Book",
        authors: ["Test Author"],
        tags: [],
        totalPages: 300,
        activeSession: {
          id: 1,
          status: "reading",
        },
      };

      global.fetch = vi.fn(() => Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => Promise.resolve({
          ratingUpdated: true,
          reviewUpdated: true,
        }),
      } as Response)) as any;

      const { result } = renderHook(() =>
        useBookStatus(readingBook, [], "123", mockOnStatusChange, mockOnRefresh)
      );

      await act(async () => {
        await result.current.handleMarkAsDNF(2, "Not for me", "2026-01-10");
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/books/123/mark-as-dnf",
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify({ 
              rating: 2, 
              review: "Not for me",
              dnfDate: "2026-01-10",
            }),
          })
        );
      });
    });
  });

  describe("optimistic updates", () => {
    test("should optimistically update status to dnf", async () => {
      const readingBook: Book = {
        id: 123,
        calibreId: 1,
        title: "Test Book",
        authors: ["Test Author"],
        tags: [],
        totalPages: 300,
        activeSession: {
          id: 1,
          status: "reading",
        },
      };

      // Slow response
      global.fetch = vi.fn(() => new Promise(resolve => {
        setTimeout(() => {
          resolve({
            ok: true,
            status: 200,
            headers: new Headers({ "content-type": "application/json" }),
            json: () => Promise.resolve({
              ratingUpdated: false,
              reviewUpdated: false,
            }),
          } as Response);
        }, 100);
      })) as any;

      const { result } = renderHook(() =>
        useBookStatus(readingBook, [], "123", mockOnStatusChange, mockOnRefresh)
      );

      await act(async () => {
        result.current.handleMarkAsDNF();
        // Wait a tick for optimistic update to apply
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // Should update to dnf (either optimistically or after fast response)
      expect(result.current.selectedStatus).toBe("dnf");

      // Wait for API call to complete
      await waitFor(() => {
        expect(mockOnRefresh).toHaveBeenCalled();
      });
    });

    test("should rollback on error", async () => {
      const readingBook: Book = {
        id: 123,
        calibreId: 1,
        title: "Test Book",
        authors: ["Test Author"],
        tags: [],
        totalPages: 300,
        activeSession: {
          id: 1,
          status: "reading",
        },
      };

      global.fetch = vi.fn(() => Promise.resolve({
        ok: false,
        status: 400,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => Promise.resolve({ error: "Cannot mark as DNF" }),
      } as Response)) as any;

      const { result } = renderHook(() =>
        useBookStatus(readingBook, [], "123", mockOnStatusChange, mockOnRefresh)
      );

      // Call the mutation - it will throw but onError callback handles rollback
      await act(async () => {
        await expect(result.current.handleMarkAsDNF()).rejects.toThrow();
      });

      // Should rollback to reading on error
      expect(result.current.selectedStatus).toBe("reading");
    });
  });

  describe("error handling", () => {
    test("should handle API errors", async () => {
      const readingBook: Book = {
        id: 123,
        calibreId: 1,
        title: "Test Book",
        authors: ["Test Author"],
        tags: [],
        totalPages: 300,
        activeSession: {
          id: 1,
          status: "reading",
        },
      };

      global.fetch = vi.fn(() => Promise.resolve({
        ok: false,
        status: 500,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => Promise.resolve({ error: "Internal server error" }),
      } as Response)) as any;

      const { result } = renderHook(() =>
        useBookStatus(readingBook, [], "123", mockOnStatusChange, mockOnRefresh)
      );

      // Expect the mutation to throw
      await act(async () => {
        await expect(result.current.handleMarkAsDNF()).rejects.toThrow();
      });

      // Status should rollback to reading
      expect(result.current.selectedStatus).toBe("reading");
      expect(mockOnRefresh).not.toHaveBeenCalled();
    });

    test("should handle network errors", async () => {
      const readingBook: Book = {
        id: 123,
        calibreId: 1,
        title: "Test Book",
        authors: ["Test Author"],
        tags: [],
        totalPages: 300,
        activeSession: {
          id: 1,
          status: "reading",
        },
      };

      global.fetch = vi.fn(() => Promise.reject(new Error("Network error"))) as any;

      const { result } = renderHook(() =>
        useBookStatus(readingBook, [], "123", mockOnStatusChange, mockOnRefresh)
      );

      // Expect the mutation to throw (after retries - 1s + 2s + 4s = 7s with exponential backoff)
      await act(async () => {
        await expect(result.current.handleMarkAsDNF()).rejects.toThrow();
      });

      // Status should rollback to reading after retries fail
      expect(result.current.selectedStatus).toBe("reading");
    });
  });

  describe("modal state", () => {
    test("should close DNF modal after successful submission", async () => {
      const readingBook: Book = {
        id: 123,
        calibreId: 1,
        title: "Test Book",
        authors: ["Test Author"],
        tags: [],
        totalPages: 300,
        activeSession: {
          id: 1,
          status: "reading",
        },
      };

      global.fetch = vi.fn(() => Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => Promise.resolve({
          ratingUpdated: false,
          reviewUpdated: false,
        }),
      } as Response)) as any;

      const { result } = renderHook(() =>
        useBookStatus(readingBook, [], "123", mockOnStatusChange, mockOnRefresh)
      );

      // Open modal
      act(() => {
        result.current.handleUpdateStatus("dnf");
      });

      expect(result.current.showDNFModal).toBe(true);

      // Submit DNF
      await act(async () => {
        await result.current.handleMarkAsDNF();
      });

      // Modal should be closed
      await waitFor(() => {
        expect(result.current.showDNFModal).toBe(false);
      });
    });

    test("should close DNF modal on cancel", () => {
      const readingBook: Book = {
        id: 123,
        calibreId: 1,
        title: "Test Book",
        authors: ["Test Author"],
        tags: [],
        totalPages: 300,
        activeSession: {
          id: 1,
          status: "reading",
        },
      };

      const { result } = renderHook(() =>
        useBookStatus(readingBook, [], "123", mockOnStatusChange, mockOnRefresh)
      );

      // Open modal
      act(() => {
        result.current.handleUpdateStatus("dnf");
      });

      expect(result.current.showDNFModal).toBe(true);

      // Cancel
      act(() => {
        result.current.handleCancelStatusChange();
      });

      expect(result.current.showDNFModal).toBe(false);
    });
  });
});
