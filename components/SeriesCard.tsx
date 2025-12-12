'use client';

import Link from 'next/link';
import Image from 'next/image';
import { BookMarked } from 'lucide-react';

interface SeriesCardProps {
  name: string;
  bookCount: number;
  bookCoverIds: number[];
}

/**
 * SeriesCard - Display a series with overlapping book covers
 * Shows up to 3 book covers in a stacked/collage layout with hover effects
 */
export default function SeriesCard({ name, bookCount, bookCoverIds }: SeriesCardProps) {
  const hasCovers = bookCoverIds.length > 0;

  return (
    <Link
      href={`/series/${encodeURIComponent(name)}`}
      className="group block bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg shadow-md hover:shadow-xl hover:border-[var(--accent)] transition-all duration-300 overflow-hidden"
    >
      {/* Cover Collage Section */}
      <div className="relative h-[180px] bg-gradient-to-br from-[var(--light-accent)]/30 to-[var(--light-accent)]/10 overflow-hidden">
        {hasCovers ? (
          <div className="absolute inset-0 flex items-center justify-center">
            {/* Stack of covers with rotation and offset */}
            {bookCoverIds.slice(0, 3).map((calibreId, index) => {
              const rotations = ['-rotate-6', 'rotate-0', 'rotate-6'];
              const leftPositions = ['left-[20px]', 'left-[60px]', 'left-[100px]'];
              const zIndexes = ['z-10', 'z-20', 'z-30'];
              
              return (
                <div
                  key={calibreId}
                  className={`absolute ${leftPositions[index]} ${zIndexes[index]} transition-all duration-300 group-hover:scale-105`}
                  style={{
                    transform: `translateX(${index * 0}px)`,
                  }}
                >
                  <div
                    className={`${rotations[index]} transition-transform duration-300 group-hover:translate-x-${index * 4}`}
                  >
                    <Image
                      src={`/api/books/${calibreId}/cover`}
                      alt={`Cover ${index + 1}`}
                      width={80}
                      height={120}
                      className="rounded shadow-lg border-2 border-[var(--card-bg)]"
                      unoptimized
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          // Fallback when no covers available
          <div className="flex items-center justify-center h-full">
            <BookMarked className="w-16 h-16 text-[var(--foreground)]/30" />
          </div>
        )}
      </div>

      {/* Series Info Section */}
      <div className="p-4">
        <h3 className="font-semibold text-lg text-[var(--heading-text)] group-hover:text-[var(--accent)] transition-colors line-clamp-2 mb-2">
          {name}
        </h3>
        <p className="text-sm text-[var(--foreground)]/60 font-medium">
          {bookCount} {bookCount === 1 ? 'book' : 'books'}
        </p>
      </div>
    </Link>
  );
}
