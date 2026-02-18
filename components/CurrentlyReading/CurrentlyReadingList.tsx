"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { BookOpen, Pencil } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import LogProgressModal from "@/components/Modals/LogProgressModal";
import FinishBookModal from "@/components/Modals/FinishBookModal";
import { getCoverUrl } from "@/lib/utils/cover-url";
import { getLogger } from "@/lib/logger";
import { toast } from "@/utils/toast";

const logger = getLogger().child({ component: "CurrentlyReadingList" });

interface Book {
  id: number;
  calibreId: number | null;
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
  updatedAt?: Date | string | null;
}

interface CurrentlyReadingListProps {
  books: Book[];
  isMobile?: boolean;
}

export default function CurrentlyReadingList({
  books,
  isMobile = false,
}: CurrentlyReadingListProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [imageErrors, setImageErrors] = useState<Set<number>>(new Set());

  // Completion modal state — lifted here so it survives dashboard data refreshes
  // that unmount LogProgressModal when the book moves from "reading" to "read"
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [completedBookId, setCompletedBookId] = useState<number | null>(null);
  const [completedBookTitle, setCompletedBookTitle] = useState("");
  const [completedSessionId, setCompletedSessionId] = useState<number | undefined>();

  const handleLogProgress = (book: Book) => {
    setSelectedBook(book);
    setShowProgressModal(true);
  };

  const handleCloseModal = () => {
    setShowProgressModal(false);
    setSelectedBook(null);
  };

  const handleImageError = (bookId: number) => {
    setImageErrors((prev) => new Set(prev).add(bookId));
  };

  // Called by LogProgressModal on mobile when progress reaches 100%
  const handleBookCompleted = (bookId: number, bookTitle: string, sessionId?: number) => {
    logger.info({ bookId, sessionId }, "Book completed on mobile, showing finish modal");
    setCompletedBookId(bookId);
    setCompletedBookTitle(bookTitle);
    setCompletedSessionId(sessionId);
    setShowCompletionModal(true);
  };

  const handleConfirmFinish = async (rating?: number, review?: string) => {
    if (!completedBookId) return;
    try {
      if (rating && rating > 0) {
        const ratingResponse = await fetch(`/api/books/${completedBookId}/rating`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rating }),
        });
        if (!ratingResponse.ok) throw new Error("Failed to update rating");
      }

      if (review && completedSessionId) {
        const sessionResponse = await fetch(`/api/books/${completedBookId}/sessions/${completedSessionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ review }),
        });
        if (!sessionResponse.ok) throw new Error("Failed to update review");
      }

      setShowCompletionModal(false);
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      await queryClient.invalidateQueries({ queryKey: ['book', completedBookId] });
      await queryClient.invalidateQueries({ queryKey: ['sessions', completedBookId] });
      await queryClient.invalidateQueries({ queryKey: ['library-books'] });
      router.refresh();
      toast.success("Book completed!");
    } catch (error) {
      logger.error({ error }, "Failed to update rating/review");
      toast.error("Failed to update rating/review");
    }
  };

  const handleCloseCompletionModal = () => {
    setShowCompletionModal(false);
  };

  return (
    <>
      {books.length === 0 ? (
        <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-md p-8 text-center h-[156px] flex flex-col items-center justify-center">
          <BookOpen className="w-12 h-12 text-[var(--light-accent)] mx-auto mb-3" />
          <p className="text-[var(--foreground)] font-medium">
            No books in progress. Start reading from your{" "}
            <Link
              href="/library"
              className="text-[var(--accent)] hover:text-[var(--light-accent)] font-semibold"
            >
              library
            </Link>
            !
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
          {books.map((book) => {
          const progressPercentage = book.latestProgress?.currentPercentage || 0;
          const hasImageError = imageErrors.has(book.id);

          return (
            <div
              key={book.id}
              className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg p-4 hover:shadow-md transition-shadow group"
            >
              <div className="flex gap-4 items-center">
                {/* Book Cover Thumbnail */}
                <Link href={`/books/${book.id}`} className="flex-shrink-0">
                  <div className="w-16 h-24 bg-[var(--light-accent)]/30 flex items-center justify-center overflow-hidden rounded relative shadow-md group-hover:shadow-lg transition-shadow">
                    {!hasImageError ? (
                      <Image
                        src={getCoverUrl(book.id, book.updatedAt)}
                        alt={book.title}
                        fill
                        loading="lazy"
                        className="object-cover"
                        onError={() => handleImageError(book.id)}
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
                  <div className="text-sm text-[var(--subheading-text)] line-clamp-1 font-serif font-medium">
                    {book.authors.map((author, index) => (
                      <span key={author}>
                        <Link
                          href={`/library?search=${encodeURIComponent(author)}`}
                          className="hover:underline"
                        >
                          {author}
                        </Link>
                        {index < book.authors.length - 1 && ", "}
                      </span>
                    ))}
                  </div>

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
                      className="p-1.5 text-[var(--light-accent)] hover:text-[var(--accent)] hover:bg-[var(--background)] rounded-full transition-colors"
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
      )}

      {/* Progress Modal */}
      {selectedBook && (
        <LogProgressModal
          isOpen={showProgressModal}
          onClose={handleCloseModal}
          book={selectedBook}
          isMobile={isMobile}
          onBookCompleted={isMobile ? handleBookCompleted : undefined}
        />
      )}

      {/* Completion Modal — rendered here so it survives LogProgressModal unmounting */}
      {isMobile && (
        <FinishBookModal
          isOpen={showCompletionModal}
          onClose={handleCloseCompletionModal}
          onConfirm={handleConfirmFinish}
          bookTitle={completedBookTitle}
          bookId={completedBookId?.toString() ?? ""}
          sessionId={completedSessionId}
        />
      )}
    </>
  );
}
