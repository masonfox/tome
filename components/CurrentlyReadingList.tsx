"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { BookOpen, TrendingUp } from "lucide-react";
import LogProgressModal from "./LogProgressModal";

interface Book {
  id: number;
  calibreId: number;
  title: string;
  authors: string[];
  totalPages?: number;
  latestProgress?: {
    currentPage: number;
    currentPercentage: number;
  };
  activeSession?: {
    status: string;
  };
}

interface CurrentlyReadingListProps {
  books: Book[];
  isMobile?: boolean;
}

export default function CurrentlyReadingList({
  books,
  isMobile = false,
}: CurrentlyReadingListProps) {
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [imageErrors, setImageErrors] = useState<Set<number>>(new Set());

  const handleLogProgress = (book: Book) => {
    setSelectedBook(book);
    setShowProgressModal(true);
  };

  const handleCloseModal = () => {
    setShowProgressModal(false);
    setSelectedBook(null);
  };

  const handleImageError = (calibreId: number) => {
    setImageErrors((prev) => new Set(prev).add(calibreId));
  };

  return (
    <>
      <div className="space-y-3">
        {books.map((book) => {
          const progressPercentage = book.latestProgress?.currentPercentage || 0;
          const hasImageError = imageErrors.has(book.calibreId);

          return (
            <div
              key={book.id}
              className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex gap-4">
                {/* Book Cover Thumbnail */}
                <Link href={`/books/${book.id}`} className="flex-shrink-0">
                  <div className="w-16 h-24 bg-[var(--light-accent)]/30 flex items-center justify-center overflow-hidden rounded relative">
                    {!hasImageError ? (
                      <Image
                        src={`/api/books/${book.calibreId}/cover`}
                        alt={book.title}
                        fill
                        loading="lazy"
                        className="object-cover"
                        onError={() => handleImageError(book.calibreId)}
                      />
                    ) : (
                      <BookOpen className="w-8 h-8 text-[var(--accent)]/40" />
                    )}
                  </div>
                </Link>

                {/* Book Info */}
                <div className="flex-1 min-w-0">
                  <Link href={`/books/${book.id}`}>
                    <h3 className="font-semibold text-[var(--heading-text)] line-clamp-1 hover:text-[var(--accent)] transition-colors">
                      {book.title}
                    </h3>
                  </Link>
                  <p className="text-sm text-[var(--subheading-text)] line-clamp-1 font-medium">
                    {book.authors.join(", ")}
                  </p>

                  {/* Progress Bar */}
                  <div className="mt-2 flex items-center gap-3">
                    <div className="flex-1 bg-[var(--background)] rounded-full h-2 shadow-inner">
                      <div
                        className="bg-gradient-to-r from-[var(--accent)] to-[var(--light-accent)] h-2 rounded-full transition-all duration-300 ease-out"
                        style={{ width: `${Math.min(100, progressPercentage)}%` }}
                      />
                    </div>
                    <span className="text-sm font-mono font-bold text-[var(--accent)] min-w-[3rem] text-right">
                      {Math.round(progressPercentage)}%
                    </span>
                  </div>
                </div>

                {/* Log Progress Button */}
                <div className="flex-shrink-0 flex items-center">
                  <button
                    onClick={() => handleLogProgress(book)}
                    className="px-3 py-1.5 border border-[var(--border-color)] text-[var(--foreground)] bg-transparent rounded-md text-sm font-medium hover:bg-[var(--background)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors flex items-center gap-1.5"
                    title="Log progress"
                  >
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Log</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Progress Modal */}
      {selectedBook && (
        <LogProgressModal
          isOpen={showProgressModal}
          onClose={handleCloseModal}
          book={selectedBook}
          isMobile={isMobile}
        />
      )}
    </>
  );
}
