"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { BookOpen, Pencil } from "lucide-react";
import LogProgressModal from "@/components/Modals/LogProgressModal";
import { getCoverUrl } from "@/lib/utils/cover-url";

interface Book {
  id: number;
  calibreId: number;
  title: string;
  authors: string[];
  totalPages?: number;
  latestProgress?: {
    currentPage: number;
    currentPercentage: number;
  } | null;
  activeSession?: {
    status: string;
  };
  lastSynced?: Date | string | null;
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
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
        {books.map((book) => {
          const progressPercentage = book.latestProgress?.currentPercentage || 0;
          const hasImageError = imageErrors.has(book.calibreId);

          return (
            <div
              key={book.id}
              className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex gap-4 items-center">
                {/* Book Cover Thumbnail */}
                <Link href={`/books/${book.id}`} className="flex-shrink-0">
                  <div className="w-16 h-24 bg-[var(--light-accent)]/30 flex items-center justify-center overflow-hidden rounded relative">
                    {!hasImageError ? (
                      <Image
                        src={getCoverUrl(book.calibreId, book.lastSynced)}
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
                  <p className="text-sm text-[var(--subheading-text)] line-clamp-1 font-serif font-medium">
                    {book.authors.join(", ")}
                  </p>

                  {/* Progress Bar */}
                  <div className="mt-2 flex items-center gap-3">
                    <span className="text-sm font-mono font-bold text-[var(--accent)]">
                      {Math.round(progressPercentage)}%
                    </span>
                    <div className="flex-1 bg-[var(--background)] rounded-full h-2 shadow-inner">
                      <div
                        className="bg-gradient-to-r from-[var(--accent)] to-[var(--light-accent)] h-2 rounded-full transition-all duration-300 ease-out"
                        style={{ width: `${Math.min(100, progressPercentage)}%` }}
                      />
                    </div>
                    {/* Update Button - Icon Only */}
                    <button
                      onClick={() => handleLogProgress(book)}
                      className="p-1.5 text-[var(--accent)] hover:text-[var(--light-accent)] hover:bg-[var(--background)] rounded transition-colors"
                      title="Update progress"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  </div>
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
