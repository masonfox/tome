"use client";

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
  } | null;
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

  // Always render CurrentlyReadingList (even when books is empty) so that
  // mobile completion modal state survives dashboard data refreshes that
  // remove the completed book from the currentlyReading list.
  return <CurrentlyReadingList books={books} isMobile={isMobile} />;
}
