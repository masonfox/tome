"use client";

import { X, Loader2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { BookOpen } from "lucide-react";
import { cn } from "@/utils/cn";
import { RemoveTagFromBookModal } from "./RemoveTagFromBookModal";

export interface Book {
  id: number;
  title: string;
  authors?: string[];
  calibreId: number;
}

interface TagDetailPanelProps {
  tagName: string | null;
  books: Book[];
  loading: boolean;
  totalBooks: number;
  onRemoveTag: (bookId: number) => void;
  onClose?: () => void; // For mobile back navigation
  confirmRemoval: boolean;
}

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
            className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
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

export function TagDetailPanel({
  tagName,
  books,
  loading,
  totalBooks,
  onRemoveTag,
  onClose,
  confirmRemoval,
}: TagDetailPanelProps) {
  if (!tagName) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-[var(--subheading-text)]">
          <p className="text-lg font-medium">Select a tag to view books</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-[var(--border-color)]">
        <div className="flex-1 min-w-0 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold text-[var(--heading-text)] truncate">
              {tagName}
            </h2>
            <p className="text-sm text-[var(--subheading-text)] mt-1">
              {loading ? (
                <span className="inline-block h-4 w-20 bg-[var(--foreground)]/10 rounded animate-pulse" />
              ) : (
                <>
                  {totalBooks} {totalBooks === 1 ? "book" : "books"}
                </>
              )}
            </p>
          </div>
          {loading && (
            <Loader2 className="w-5 h-5 text-[var(--accent)] animate-spin flex-shrink-0" />
          )}
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden p-2 rounded-lg hover:bg-[var(--foreground)]/10 transition-colors"
            title="Back to tags"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Books grid */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {loading ? (
          <div className="grid lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
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
          <div className="grid lg:grid-cols-4 xl:grid-cols-5 gap-4">
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
  );
}
