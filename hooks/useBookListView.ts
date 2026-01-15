/**
 * useBookListView Hook
 * 
 * Shared state management and logic for book list views (shelves, read-next, etc.)
 * Handles mobile detection, filtering, and multi-select functionality.
 * 
 * Extracts common patterns from /shelves/[id] and /read-next pages to eliminate duplication.
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import type { Book } from "@/lib/db/schema/books";

interface UseBookListViewOptions {
  books: Book[];
  /** Optional initial filter text */
  initialFilter?: string;
}

export function useBookListView({ books, initialFilter = "" }: UseBookListViewOptions) {
  // Mobile detection
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024); // < lg breakpoint
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Filter state
  const [filterText, setFilterText] = useState(initialFilter);

  // Multi-select state
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedBookIds, setSelectedBookIds] = useState<Set<number>>(new Set());

  // Filter books based on search text
  const filteredBooks = useMemo(() => {
    if (!filterText.trim()) return books;

    const searchLower = filterText.toLowerCase();
    return books.filter((book) => {
      const titleMatch = book.title.toLowerCase().includes(searchLower);
      const authorMatch = book.authors.some((author) =>
        author.toLowerCase().includes(searchLower)
      );
      const seriesMatch = book.series?.toLowerCase().includes(searchLower);

      return titleMatch || authorMatch || seriesMatch;
    });
  }, [books, filterText]);

  // Toggle select mode (clears selection when toggling)
  const toggleSelectMode = useCallback(() => {
    setIsSelectMode((prev) => !prev);
    setSelectedBookIds(new Set());
  }, []);

  // Toggle selection for a single book
  const toggleBookSelection = useCallback((bookId: number) => {
    setSelectedBookIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(bookId)) {
        newSet.delete(bookId);
      } else {
        newSet.add(bookId);
      }
      return newSet;
    });
  }, []);

  // Toggle select all visible books
  const toggleSelectAll = useCallback(() => {
    if (selectedBookIds.size === filteredBooks.length && filteredBooks.length > 0) {
      // Deselect all
      setSelectedBookIds(new Set());
    } else {
      // Select all visible books
      setSelectedBookIds(new Set(filteredBooks.map((book) => book.id)));
    }
  }, [filteredBooks, selectedBookIds.size]);

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedBookIds(new Set());
  }, []);

  // Exit select mode and clear selection
  const exitSelectMode = useCallback(() => {
    setIsSelectMode(false);
    setSelectedBookIds(new Set());
  }, []);

  return {
    // Mobile detection
    isMobile,

    // Filter state
    filterText,
    setFilterText,
    filteredBooks,

    // Selection state
    isSelectMode,
    selectedBookIds,
    toggleSelectMode,
    toggleBookSelection,
    toggleSelectAll,
    clearSelection,
    exitSelectMode,
  };
}
