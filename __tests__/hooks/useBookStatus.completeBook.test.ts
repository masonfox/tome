/**
 * Tests for useBookStatus hook - CompleteBook workflow
 * 
 * This test suite covers the completeBook mutation functionality including:
 * - Modal triggering from non-reading statuses
 * - handleCompleteBook mutation with various parameters
 * - Optimistic updates and rollbacks
 * - Error handling
 * - Modal state management
 */

import { describe, test, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor, act } from "../test-utils";
import { useBookStatus } from "@/hooks/useBookStatus";
import type { Book } from "@/hooks/useBookDetail";

describe("useBookStatus - CompleteBook workflow", () => {
  const mockOnStatusChange = vi.fn(() => {});
  const mockOnRefresh = vi.fn(() => {});

  beforeEach(() => {
    // Default successful API response
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => Promise.resolve({ success: true }),
      } as Response)
    ) as any;
    
    mockOnStatusChange.mockClear();
    mockOnRefresh.mockClear();
  });

  describe("CompleteBook modal triggering", () => {
    test("should show CompleteBook modal when selecting 'read' from non-reading status", () => {
      const toReadBook: Book = {
        id: 123,
        calibreId: 1,
        title: "Test Book",
        authors: ["Test Author"],
        tags: [],
        totalPages: 300,
        activeSession: undefined,
      };

      const { result } = renderHook(() =>
        useBookStatus(toReadBook, [], "123", mockOnStatusChange, mockOnRefresh)
      );

      expect(result.current.showCompleteBookModal).toBe(false);

      act(() => {
        result.current.handleUpdateStatus("read");
      });

      expect(result.current.showCompleteBookModal).toBe(true);
    });

    test("should NOT show CompleteBook modal when selecting 'read' from reading status", () => {
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
        result.current.handleUpdateStatus("read");
      });

      // Should NOT show modal - handleConfirmRead is for reading -> read
      expect(result.current.showCompleteBookModal).toBe(false);
    });
  });

  describe("handleCompleteBook", () => {
    test("should complete book with totalPages", async () => {
      const toReadBook: Book = {
        id: 123,
        calibreId: 1,
        title: "Test Book",
        authors: ["Test Author"],
        tags: [],
        totalPages: 300,
        activeSession: undefined,
      };

      const { result } = renderHook(() =>
        useBookStatus(toReadBook, [], "123", mockOnStatusChange, mockOnRefresh)
      );

      const completeData = {
        totalPages: 350,
        startDate: "2024-01-01",
        endDate: "2024-01-15",
      };

      await act(async () => {
        await result.current.handleCompleteBook(completeData);
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/books/123/complete",
          expect.objectContaining({
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(completeData),
          })
        );
      });

      expect(mockOnRefresh).toHaveBeenCalled();
    });

    test("should complete book without totalPages", async () => {
      const toReadBook: Book = {
        id: 123,
        calibreId: 1,
        title: "Test Book",
        authors: ["Test Author"],
        tags: [],
        totalPages: 300,
        activeSession: undefined,
      };

      const { result } = renderHook(() =>
        useBookStatus(toReadBook, [], "123", mockOnStatusChange, mockOnRefresh)
      );

      const completeData = {
        startDate: "2024-01-01",
        endDate: "2024-01-15",
      };

      await act(async () => {
        await result.current.handleCompleteBook(completeData);
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/books/123/complete",
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify(completeData),
          })
        );
      });

      expect(mockOnRefresh).toHaveBeenCalled();
    });

    test("should complete book with rating", async () => {
      const toReadBook: Book = {
        id: 123,
        calibreId: 1,
        title: "Test Book",
        authors: ["Test Author"],
        tags: [],
        totalPages: 300,
        activeSession: undefined,
      };

      const { result } = renderHook(() =>
        useBookStatus(toReadBook, [], "123", mockOnStatusChange, mockOnRefresh)
      );

      const completeData = {
        startDate: "2024-01-01",
        endDate: "2024-01-15",
        rating: 5,
      };

      await act(async () => {
        await result.current.handleCompleteBook(completeData);
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/books/123/complete",
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify(completeData),
          })
        );
      });

      expect(mockOnRefresh).toHaveBeenCalled();
    });

    test("should complete book with review", async () => {
      const toReadBook: Book = {
        id: 123,
        calibreId: 1,
        title: "Test Book",
        authors: ["Test Author"],
        tags: [],
        totalPages: 300,
        activeSession: undefined,
      };

      const { result } = renderHook(() =>
        useBookStatus(toReadBook, [], "123", mockOnStatusChange, mockOnRefresh)
      );

      const completeData = {
        startDate: "2024-01-01",
        endDate: "2024-01-15",
        review: "Great book!",
      };

      await act(async () => {
        await result.current.handleCompleteBook(completeData);
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/books/123/complete",
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify(completeData),
          })
        );
      });

      expect(mockOnRefresh).toHaveBeenCalled();
    });

    test("should complete book with all parameters", async () => {
      const toReadBook: Book = {
        id: 123,
        calibreId: 1,
        title: "Test Book",
        authors: ["Test Author"],
        tags: [],
        totalPages: 300,
        activeSession: undefined,
      };

      const { result } = renderHook(() =>
        useBookStatus(toReadBook, [], "123", mockOnStatusChange, mockOnRefresh)
      );

      const completeData = {
        totalPages: 350,
        startDate: "2024-01-01",
        endDate: "2024-01-15",
        rating: 5,
        review: "Absolutely fantastic!",
      };

      await act(async () => {
        await result.current.handleCompleteBook(completeData);
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/books/123/complete",
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify(completeData),
          })
        );
      });

      expect(mockOnRefresh).toHaveBeenCalled();
    });
  });

  describe("optimistic updates", () => {
    test("should optimistically update status to read", async () => {
      const toReadBook: Book = {
        id: 123,
        calibreId: 1,
        title: "Test Book",
        authors: ["Test Author"],
        tags: [],
        totalPages: 300,
        activeSession: undefined,
      };

      // Slow response
      global.fetch = vi.fn(() => new Promise(resolve => {
        setTimeout(() => {
          resolve({
            ok: true,
            status: 200,
            headers: new Headers({ "content-type": "application/json" }),
            json: () => Promise.resolve({ success: true }),
          } as Response);
        }, 100);
      })) as any;

      const { result } = renderHook(() =>
        useBookStatus(toReadBook, [], "123", mockOnStatusChange, mockOnRefresh)
      );

      await act(async () => {
        result.current.handleCompleteBook({
          startDate: "2024-01-01",
          endDate: "2024-01-15",
        });
        // Wait a tick for optimistic update to apply
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // Should update to read (either optimistically or after fast response)
      expect(result.current.selectedStatus).toBe("read");

      // Wait for API call to complete
      await waitFor(() => {
        expect(mockOnRefresh).toHaveBeenCalled();
      });
    });

    test("should rollback on error", async () => {
      const toReadBook: Book = {
        id: 123,
        calibreId: 1,
        title: "Test Book",
        authors: ["Test Author"],
        tags: [],
        totalPages: 300,
        activeSession: undefined,
      };

      global.fetch = vi.fn(() => Promise.resolve({
        ok: false,
        status: 400,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => Promise.resolve({ error: "Cannot complete book" }),
      } as Response)) as any;

      const { result } = renderHook(() =>
        useBookStatus(toReadBook, [], "123", mockOnStatusChange, mockOnRefresh)
      );

      // Call the mutation - it will throw but onError callback handles rollback
      await act(async () => {
        await expect(result.current.handleCompleteBook({
          startDate: "2024-01-01",
          endDate: "2024-01-15",
        })).rejects.toThrow();
      });

      // Should rollback to to-read on error
      expect(result.current.selectedStatus).toBe("to-read");
    });
  });

  describe("error handling", () => {
    test("should handle API errors", { timeout: 10000 }, async () => {
      const toReadBook: Book = {
        id: 123,
        calibreId: 1,
        title: "Test Book",
        authors: ["Test Author"],
        tags: [],
        totalPages: 300,
        activeSession: undefined,
      };

      global.fetch = vi.fn(() => Promise.resolve({
        ok: false,
        status: 500,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => Promise.resolve({ error: "Internal server error" }),
      } as Response)) as any;

      const { result } = renderHook(() =>
        useBookStatus(toReadBook, [], "123", mockOnStatusChange, mockOnRefresh)
      );

      // Expect the mutation to throw (retries: 1s + 2s + 4s = 7s with exponential backoff)
      await act(async () => {
        await expect(result.current.handleCompleteBook({
          startDate: "2024-01-01",
          endDate: "2024-01-15",
        })).rejects.toThrow();
      });

      // Status should rollback to to-read
      expect(result.current.selectedStatus).toBe("to-read");
      expect(mockOnRefresh).not.toHaveBeenCalled();
    });

    test("should handle network errors", { timeout: 10000 }, async () => {
      const toReadBook: Book = {
        id: 123,
        calibreId: 1,
        title: "Test Book",
        authors: ["Test Author"],
        tags: [],
        totalPages: 300,
        activeSession: undefined,
      };

      global.fetch = vi.fn(() => Promise.reject(new Error("Network error"))) as any;

      const { result } = renderHook(() =>
        useBookStatus(toReadBook, [], "123", mockOnStatusChange, mockOnRefresh)
      );

      // Expect the mutation to throw (after retries - 1s + 2s + 4s = 7s with exponential backoff)
      await act(async () => {
        await expect(result.current.handleCompleteBook({
          startDate: "2024-01-01",
          endDate: "2024-01-15",
        })).rejects.toThrow();
      });

      // Status should rollback to to-read after retries fail
      expect(result.current.selectedStatus).toBe("to-read");
    });
  });

  describe("modal state", () => {
    test("should close CompleteBook modal after successful submission", async () => {
      const toReadBook: Book = {
        id: 123,
        calibreId: 1,
        title: "Test Book",
        authors: ["Test Author"],
        tags: [],
        totalPages: 300,
        activeSession: undefined,
      };

      const { result } = renderHook(() =>
        useBookStatus(toReadBook, [], "123", mockOnStatusChange, mockOnRefresh)
      );

      // Open modal
      act(() => {
        result.current.handleUpdateStatus("read");
      });

      expect(result.current.showCompleteBookModal).toBe(true);

      // Complete the book
      await act(async () => {
        await result.current.handleCompleteBook({
          startDate: "2024-01-01",
          endDate: "2024-01-15",
        });
      });

      // Modal should be closed after success
      await waitFor(() => {
        expect(result.current.showCompleteBookModal).toBe(false);
      });
    });
  });
});
