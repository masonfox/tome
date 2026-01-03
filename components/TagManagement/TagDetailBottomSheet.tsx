"use client";

import { useEffect, useState, useRef, memo, useCallback } from "react";
import { X, Tag, Loader2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { RemoveTagFromBookModal } from "./RemoveTagFromBookModal";

export interface Book {
  id: number;
  title: string;
  authors?: string[];
  calibreId: number;
}

interface TagDetailBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  tagName: string | null;
  books: Book[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  totalBooks: number;
  onRemoveTag: (bookId: number) => void;
  onLoadMore: () => void;
  confirmRemoval: boolean;
}

// Animation duration for closing transition
const CLOSE_ANIMATION_MS = 300;

const BookCardSimple = memo(function BookCardSimple({
  book,
  onRemove,
  confirmRemoval,
  tagName,
}: {
  book: Book;
  onRemove: () => Promise<void>;
  confirmRemoval: boolean;
  tagName: string;
}) {
  const [imageError, setImageError] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  const handleRemoveClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (confirmRemoval) {
      setShowRemoveModal(true);
    } else {
      handleConfirmRemove();
    }
  }, [confirmRemoval]);

  const handleConfirmRemove = useCallback(async () => {
    setIsRemoving(true);
    try {
      await onRemove();
      setShowRemoveModal(false);
    } catch (error) {
      // Error is handled by parent with toast
      // Keep modal open so user can retry
    } finally {
      setIsRemoving(false);
    }
  }, [onRemove]);

  const handleCloseModal = useCallback(() => setShowRemoveModal(false), []);

  return (
    <>
      <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg overflow-hidden group hover:shadow-md transition-shadow">
        <div className="relative">
          <Link href={`/books/${book.id}`}>
            <div className="aspect-[2/3] bg-[var(--light-accent)]/30 flex items-center justify-center overflow-hidden relative">
              {!imageError ? (
                <Image
                  src={`/api/books/${book.calibreId}/cover`}
                  alt={book.title}
                  fill
                  loading="lazy"
                  className="object-cover group-hover:opacity-95 transition-opacity"
                  onError={() => setImageError(true)}
                />
              ) : (
                <BookOpen className="w-12 h-12 text-[var(--accent)]/40" />
              )}
            </div>
          </Link>

          {/* Remove button overlay */}
          <button
            onClick={handleRemoveClick}
            className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-md"
            title="Remove tag from book"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <Link href={`/books/${book.id}`}>
          <div className="p-3 space-y-1">
            <h3 className="text-sm font-semibold text-[var(--heading-text)] line-clamp-2 leading-snug">
              {book.title}
            </h3>
            {book.authors && book.authors.length > 0 && (
              <p className="text-xs text-[var(--subheading-text)] line-clamp-1">
                {book.authors.join(", ")}
              </p>
            )}
          </div>
        </Link>
      </div>

      {confirmRemoval && (
        <RemoveTagFromBookModal
          isOpen={showRemoveModal}
          onClose={handleCloseModal}
          tagName={tagName}
          bookTitle={book.title}
          onConfirm={handleConfirmRemove}
          loading={isRemoving}
        />
      )}
    </>
  );
});

export const TagDetailBottomSheet = memo(function TagDetailBottomSheet({
  isOpen,
  onClose,
  tagName,
  books,
  loading,
  loadingMore,
  hasMore,
  totalBooks,
  onRemoveTag,
  onLoadMore,
  confirmRemoval,
}: TagDetailBottomSheetProps) {
  const [isClosing, setIsClosing] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const closingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const observerTarget = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver>();

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      setIsClosing(false);
      
      // Reset scroll position when tag changes
      if (contentRef.current) {
        contentRef.current.scrollTop = 0;
      }
      
      // Focus the close button to prevent browser from auto-focusing action items
      // Use double RAF to ensure this happens after browser layout and paint
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          closeButtonRef.current?.focus();
        });
      });
    } else {
      document.body.style.overflow = "";
    }
    
    return () => {
      document.body.style.overflow = "";
      // Clean up any pending timeout
      if (closingTimeoutRef.current) {
        clearTimeout(closingTimeoutRef.current);
      }
    };
  }, [isOpen, tagName]);

  // Set up intersection observer for infinite scroll - optimized to reduce recreations
  useEffect(() => {
    if (!isOpen || !contentRef.current) return;

    // Create observer only once
    if (!observerRef.current) {
      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
            onLoadMore();
          }
        },
        { 
          root: contentRef.current,
          threshold: 0.1,
          rootMargin: '800px' // Start loading 800px before the trigger element comes into view
        }
      );
    }

    const target = observerTarget.current;
    const observer = observerRef.current;

    if (target && observer) {
      observer.observe(target);
    }

    return () => {
      if (target && observer) {
        observer.unobserve(target);
      }
    };
  }, [isOpen, tagName]); // Only recreate when sheet opens or tag changes

  // Update observer callback when dependencies change
  useEffect(() => {
    if (observerRef.current && isOpen && contentRef.current) {
      // Disconnect and recreate with new callback
      observerRef.current.disconnect();
      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
            onLoadMore();
          }
        },
        { 
          root: contentRef.current,
          threshold: 0.1,
          rootMargin: '800px'
        }
      );

      const target = observerTarget.current;
      if (target) {
        observerRef.current.observe(target);
      }
    }
  }, [hasMore, loading, loadingMore, onLoadMore, isOpen]);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    closingTimeoutRef.current = setTimeout(() => {
      setIsClosing(false);
      onClose();
      closingTimeoutRef.current = null;
    }, CLOSE_ANIMATION_MS);
  }, [onClose]);

  if (!isOpen && !isClosing) return null;
  if (!tagName) return null;

  return (
    <>
      {/* Backdrop - semi-transparent to show tag list behind */}
      <div
        className={`fixed inset-0 bg-black/40 z-40 transition-opacity duration-300 ${
          isClosing ? "opacity-0 pointer-events-none" : "opacity-100"
        }`}
        onClick={handleClose}
      />
      
      {/* Bottom Sheet - full height with GPU acceleration hint */}
      <div className={`fixed bottom-0 left-0 right-0 top-0 z-50 bg-[var(--card-bg)] transition-transform duration-300 flex flex-col will-change-transform ${
        isClosing ? "translate-y-full pointer-events-none" : "translate-y-0 animate-slide-up"
      }`}>
        {/* Header - sticky with drag handle */}
        <div className="flex-shrink-0 bg-[var(--card-bg)] border-b border-[var(--border-color)]">
          {/* Drag handle */}
          <div className="flex justify-center py-3">
            <div className="w-12 h-1 bg-[var(--foreground)]/20 rounded-full" />
          </div>
          
          <div className="px-4 pb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Tag className="w-5 h-5 text-[var(--accent)] flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <h3 className="text-xl font-bold text-[var(--heading-text)] truncate">
                  {tagName}
                </h3>
                <p className="text-sm text-[var(--subheading-text)]">
                  {loading ? (
                    <span className="inline-block h-4 w-20 bg-[var(--foreground)]/10 rounded animate-pulse" />
                  ) : (
                    <>
                      {totalBooks} {totalBooks === 1 ? "book" : "books"}
                    </>
                  )}
                </p>
              </div>
            </div>
            <button
              ref={closeButtonRef}
              onClick={handleClose}
              className="text-[var(--foreground)]/50 hover:text-[var(--foreground)] transition-colors p-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded-lg flex-shrink-0"
              aria-label="Close"
              autoFocus
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content - scrollable */}
        <div 
          ref={contentRef}
          className="flex-1 overflow-y-auto overscroll-contain p-4 pb-8 custom-scrollbar"
        >
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg overflow-hidden animate-pulse"
                >
                  <div className="aspect-[2/3] bg-[var(--foreground)]/10" />
                  <div className="p-3 space-y-2">
                    <div className="h-4 bg-[var(--foreground)]/10 rounded" />
                    <div className="h-3 bg-[var(--foreground)]/10 rounded w-3/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : books.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-[var(--subheading-text)]">
                No books found with this tag
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {books.map((book) => (
                  <BookCardSimple
                    key={book.id}
                    book={book}
                    onRemove={async () => onRemoveTag(book.id)}
                    confirmRemoval={confirmRemoval}
                    tagName={tagName || ""}
                  />
                ))}
              </div>

              {/* Loading more indicator */}
              {loadingMore && (
                <div className="flex justify-center items-center py-8">
                  <Loader2 className="w-6 h-6 text-[var(--accent)] animate-spin" />
                  <span className="ml-2 text-[var(--subheading-text)]">Loading more books...</span>
                </div>
              )}

              {/* Infinite scroll trigger */}
              <div ref={observerTarget} className="py-4" />
            </>
          )}
        </div>
      </div>
    </>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for optimal re-renders
  return (
    prevProps.isOpen === nextProps.isOpen &&
    prevProps.tagName === nextProps.tagName &&
    prevProps.loading === nextProps.loading &&
    prevProps.loadingMore === nextProps.loadingMore &&
    prevProps.hasMore === nextProps.hasMore &&
    prevProps.totalBooks === nextProps.totalBooks &&
    prevProps.books.length === nextProps.books.length &&
    prevProps.confirmRemoval === nextProps.confirmRemoval &&
    prevProps.onClose === nextProps.onClose &&
    prevProps.onRemoveTag === nextProps.onRemoveTag &&
    prevProps.onLoadMore === nextProps.onLoadMore
  );
});
