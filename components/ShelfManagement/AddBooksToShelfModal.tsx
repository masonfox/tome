"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { Search, X, Check, Library as LibraryIcon, BookOpen } from "lucide-react";
import Image from "next/image";
import BaseModal from "@/components/Modals/BaseModal";
import { BottomSheet } from "@/components/Layout/BottomSheet";
import { Spinner } from "@/components/Utilities/Spinner";
import { cn } from "@/utils/cn";
import { getCoverUrl } from "@/lib/utils/cover-url";

interface BookWithStatus {
  id: number;
  calibreId: number;
  title: string;
  authors: string[];
  coverPath?: string;
  status: string | null;
  rating?: number | null;
  series?: string | null;
  tags: string[];
  totalPages?: number;
  lastSynced?: Date | string | null;
}

interface AddBooksToShelfModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddBooks: (bookIds: number[]) => Promise<{ count: number }>;
  shelfId: number;
  shelfName: string;
}

export function AddBooksToShelfModal({
  isOpen,
  onClose,
  onAddBooks,
  shelfId,
  shelfName,
}: AddBooksToShelfModalProps) {
  // Mobile detection
  const [isMobile, setIsMobile] = useState(false);
  
  // Search
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  
  // Books data
  const [books, setBooks] = useState<BookWithStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  
  // Selection
  const [selectedBookIds, setSelectedBookIds] = useState<Set<number>>(new Set());
  
  // Submission
  const [submitting, setSubmitting] = useState(false);

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Check if we should fetch books (minimum 2 characters)
  const shouldFetch = useMemo(() => {
    return debouncedSearch.trim().length >= 2;
  }, [debouncedSearch]);

  // Fetch books when search changes
  useEffect(() => {
    if (!isOpen) return;
    
    if (!shouldFetch) {
      setBooks([]);
      setHasSearched(false);
      return;
    }

    const fetchBooks = async () => {
      setLoading(true);
      setHasSearched(true);
      try {
        const params = new URLSearchParams();
        params.append("search", debouncedSearch.trim());
        params.append("limit", "50");
        params.append("skip", "0");
        params.append("excludeShelfId", shelfId.toString());

        const response = await fetch(`/api/books?${params.toString()}`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const result = await response.json();
        setBooks(result.books);
      } catch (error) {
        console.error("Failed to fetch books:", error);
        setBooks([]);
      } finally {
        setLoading(false);
      }
    };

    fetchBooks();
  }, [isOpen, debouncedSearch, shelfId, shouldFetch]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSearch("");
      setDebouncedSearch("");
      setBooks([]);
      setSelectedBookIds(new Set());
      setHasSearched(false);
    }
  }, [isOpen]);

  // Handle book selection
  const toggleBookSelection = useCallback((bookId: number) => {
    setSelectedBookIds((prev) => {
      const next = new Set(prev);
      if (next.has(bookId)) {
        next.delete(bookId);
      } else {
        next.add(bookId);
      }
      return next;
    });
  }, []);

  // Handle select all visible books
  const handleSelectAll = useCallback(() => {
    if (selectedBookIds.size === books.length && books.length > 0) {
      // Deselect all
      setSelectedBookIds(new Set());
    } else {
      // Select all visible
      setSelectedBookIds(new Set(books.map((book) => book.id)));
    }
  }, [books, selectedBookIds.size]);

  // Handle form submission
  const handleSubmit = useCallback(async () => {
    if (selectedBookIds.size === 0) return;

    setSubmitting(true);
    try {
      await onAddBooks(Array.from(selectedBookIds));
      onClose();
    } catch (error) {
      // Error handled by hook
    } finally {
      setSubmitting(false);
    }
  }, [selectedBookIds, onAddBooks, onClose]);

  const handleClose = useCallback(() => {
    if (!submitting) {
      onClose();
    }
  }, [submitting, onClose]);

  // Shared content for both mobile and desktop
  const searchAndResults = (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--foreground)]/40" />
        <input
          type="text"
          placeholder="Search books by title, author, or series (min 2 characters)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          disabled={submitting}
          autoFocus
          className={`w-full pl-10 py-2.5 bg-[var(--background)] border border-[var(--border-color)] rounded-lg text-[var(--foreground)] placeholder:text-[var(--foreground)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] disabled:opacity-50 ${
            search ? "pr-10" : "pr-4"
          }`}
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            disabled={submitting}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--foreground)]/40 hover:text-[var(--foreground)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Results */}
      <div className="pt-4">
        {!hasSearched ? (
          <div className="text-center py-16">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[var(--background)] flex items-center justify-center">
              <Search className="w-6 h-6 text-[var(--accent)]" />
            </div>
            <h3 className="text-lg font-semibold text-[var(--heading-text)] mb-2">
              Search for books to add
            </h3>
            <p className="text-sm text-[var(--subheading-text)]">
              Enter at least 2 characters to search your library
            </p>
          </div>
        ) : loading ? (
          <div className="text-center py-16">
            <Spinner size="md" />
            <p className="mt-4 text-sm text-[var(--foreground)]/60">Searching...</p>
          </div>
        ) : books.length === 0 ? (
          <div className="text-center py-16">
            <LibraryIcon className="w-16 h-16 mx-auto text-[var(--foreground)]/30 mb-4" />
            <h3 className="text-lg font-semibold text-[var(--heading-text)] mb-2">
              No books found
            </h3>
            <p className="text-sm text-[var(--foreground)]/60">
              No books match your search. Try different keywords.
            </p>
          </div>
        ) : (
          <>
            {/* Select All + Count */}
            <div className="flex items-center justify-between mb-3">
              <button
                type="button"
                onClick={handleSelectAll}
                disabled={submitting}
                className="text-sm text-[var(--accent)] hover:underline disabled:opacity-50"
              >
                {selectedBookIds.size === books.length && books.length > 0
                  ? "Deselect All"
                  : "Select All"}
              </button>
              <span className="text-sm text-[var(--foreground)]/60">
                {books.length} {books.length === 1 ? "book" : "books"} found
              </span>
            </div>

            {/* Book List */}
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2">
              {books.map((book) => {
                const isSelected = selectedBookIds.has(book.id);

                return (
                  <button
                    key={book.id}
                    type="button"
                    onClick={() => toggleBookSelection(book.id)}
                    disabled={submitting}
                    className={cn(
                      "w-full p-3 rounded-lg border text-left transition-all disabled:opacity-50 shadow-sm",
                      isSelected
                        ? "border-[var(--accent)] bg-[var(--accent)]/10 shadow-md"
                        : "border-[var(--border-color)] hover:border-[var(--accent)]/50 hover:shadow-md"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      {/* Checkbox */}
                      <div
                        className={cn(
                          "w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0",
                          isSelected
                            ? "border-[var(--accent)] bg-[var(--accent)]"
                            : "border-[var(--foreground)]/30"
                        )}
                      >
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>

                      {/* Book Cover */}
                      <BookCoverThumbnail calibreId={book.calibreId} title={book.title} lastSynced={book.lastSynced} />

                      {/* Book Info */}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-[var(--heading-text)] mb-0.5 truncate">
                          {book.title}
                        </h4>
                        <p className="text-md font-serif text-[var(--subheading-text)] truncate">
                          {book.authors.join(", ")}
                        </p>
                        
                        {/* Series */}
                        {book.series && (
                          <p className="text-xs text-[var(--foreground)]/60 mt-0.5 truncate">
                            {book.series}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );

  // Render as BottomSheet on mobile, BaseModal on desktop
  if (isMobile) {
    return (
      <BottomSheet
        isOpen={isOpen}
        onClose={handleClose}
        title="Add Books to Shelf"
        icon={<LibraryIcon className="w-5 h-5" />}
        size="full"
        allowBackdropClose={false}
      >
        {/* Subtitle */}
        <div className="mb-4">
          <p className="text-sm text-[var(--foreground)]/70 mb-3">
            {shelfName}
          </p>
          {selectedBookIds.size > 0 && (
            <p className="text-sm text-[var(--foreground)]/70">
              {selectedBookIds.size} {selectedBookIds.size === 1 ? "book" : "books"} selected
            </p>
          )}
        </div>

        {/* Content */}
        <div className="mb-20">
          {searchAndResults}
        </div>

        {/* Fixed bottom buttons */}
        <div className="fixed bottom-0 left-0 right-0 bg-[var(--card-bg)] border-t border-[var(--border-color)] p-4 flex gap-3 justify-end z-10">
          <button
            onClick={handleClose}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--hover-bg)] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={selectedBookIds.size === 0 || submitting}
            className="px-4 py-2 text-sm font-medium bg-[var(--accent)] text-white rounded-md hover:bg-[var(--light-accent)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting 
              ? "Adding..." 
              : `Add ${selectedBookIds.size || ""} ${selectedBookIds.size === 1 ? "Book" : "Books"}`
            }
          </button>
        </div>
      </BottomSheet>
    );
  }

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Books to Shelf"
      subtitle={`Search and select books to add to "${shelfName}"`}
      size="2xl"
      loading={submitting}
      allowBackdropClose={false}
      actions={
        <div className="flex gap-3 justify-between items-center w-full">
          <div className="text-sm text-[var(--foreground)]/70">
            {selectedBookIds.size > 0 && (
              <span>
                {selectedBookIds.size} {selectedBookIds.size === 1 ? "book" : "books"} selected
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--hover-bg)] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={selectedBookIds.size === 0 || submitting}
              className="px-4 py-2 text-sm font-medium bg-[var(--accent)] text-white rounded-md hover:bg-[var(--light-accent)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting 
                ? "Adding..." 
                : `Add ${selectedBookIds.size || ""} ${selectedBookIds.size === 1 ? "Book" : "Books"}`
              }
            </button>
          </div>
        </div>
      }
    >
      {searchAndResults}
    </BaseModal>
  );
}

// Book cover thumbnail component
function BookCoverThumbnail({ calibreId, title, lastSynced }: { calibreId: number; title: string; lastSynced?: Date | string | null }) {
  const [imageError, setImageError] = useState(false);

  return (
    <div className="w-12 h-16 bg-[var(--light-accent)]/30 rounded overflow-hidden flex items-center justify-center flex-shrink-0">
      {!imageError ? (
        <Image
          src={getCoverUrl(calibreId, lastSynced)}
          alt={title}
          width={48}
          height={64}
          className="w-full h-full object-cover"
          onError={() => setImageError(true)}
        />
      ) : (
        <BookOpen className="w-6 h-6 text-[var(--accent)]/40" />
      )}
    </div>
  );
}
