"use client";

import { BookOpen } from "lucide-react";
import Link from "next/link";
import CurrentlyReadingList from "./CurrentlyReadingList";
import { CurrentlyReadingCardSkeleton } from "./CurrentlyReadingCardSkeleton";
import { useEffect, useState } from "react";

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

interface CurrentlyReadingSectionProps {
  books: Book[];
  isLoading?: boolean;
}

export default function CurrentlyReadingSection({
  books,
  isLoading = false,
}: CurrentlyReadingSectionProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Detect if we're on mobile
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener("resize", checkMobile);
    
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
        {[...Array(3)].map((_, i) => (
          <CurrentlyReadingCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (books.length === 0) {
    return (
      <div className="bg-[var(--card-bg)] border border-[var(--border-color)] p-8 text-center">
        <BookOpen className="w-12 h-12 text-[var(--accent)]/40 mx-auto mb-3" />
        <p className="text-[var(--foreground)]/70 font-medium">
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
    );
  }

  return <CurrentlyReadingList books={books} isMobile={isMobile} />;
}
