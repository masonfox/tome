"use client";

import { useEffect, useState, useRef } from "react";
import { X, Tag } from "lucide-react";
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
  totalBooks: number;
  onRemoveTag: (bookId: number) => void;
  confirmRemoval: boolean;
}

// Animation duration for closing transition
const CLOSE_ANIMATION_MS = 300;

function BookCardSimple({
  book,
  onRemove,
  confirmRemoval,
  tagName,
}: {
  book: Book;
  onRemove: () => void;
  confirmRemoval: boolean;
  tagName: string;
}) {
  const [imageError, setImageError] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);

  const handleRemoveClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (confirmRemoval) {
      setShowRemoveModal(true);
    } else {
      onRemove();
    }
  };

  const handleConfirmRemove = () => {
    onRemove();
    setShowRemoveModal(false);
  };

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
          onClose={() => setShowRemoveModal(false)}
          tagName={tagName}
          bookTitle={book.title}
          onConfirm={handleConfirmRemove}
        />
      )}
    </>
  );
}

export function TagDetailBottomSheet({
  isOpen,
  onClose,
  tagName,
  books,
  loading,
  totalBooks,
  onRemoveTag,
  confirmRemoval,
}: TagDetailBottomSheetProps) {
  const [isClosing, setIsClosing] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      setIsClosing(false);
      
      // Focus the close button when sheet opens
      requestAnimationFrame(() => {
        closeButtonRef.current?.focus();
      });
    } else {
      document.body.style.overflow = "";
    }
    
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, CLOSE_ANIMATION_MS);
  };

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
      
      {/* Bottom Sheet - full height */}
      <div className={`fixed bottom-0 left-0 right-0 top-0 z-50 bg-[var(--card-bg)] transition-transform duration-300 flex flex-col ${
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
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content - scrollable */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 pb-8">
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
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {books.map((book) => (
                <BookCardSimple
                  key={book.id}
                  book={book}
                  onRemove={() => onRemoveTag(book.id)}
                  confirmRemoval={confirmRemoval}
                  tagName={tagName || ""}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
