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
      className="group block bg-[var(--card-bg)] border-2 border-[var(--border-color)] rounded-lg shadow-md hover:shadow-xl hover:border-[var(--accent)] transition-all duration-300 overflow-hidden"
    >
      {/* Cover Collage Section */}
      <div className="relative h-[180px] overflow-hidden bg-gradient-to-br from-amber-50/50 to-orange-300/20 [html[data-theme='dark']_&]:from-stone-500/40 [html[data-theme='dark']_&]:to-stone-700/30">
        {hasCovers ? (
          <div className="absolute inset-0 flex items-center justify-center">
            {/* Stack of covers with rotation and offset */}
            {bookCoverIds.slice(0, 3).map((calibreId, index) => {
              // Define explicit positions and styles for each cover
              const coverStyles = [
                { 
                  rotation: '-rotate-6',
                  left: 20,
                  zIndex: 10,
                  hoverClass: 'group-hover:translate-x-0'
                },
                { 
                  rotation: 'rotate-0',
                  left: 60,
                  zIndex: 20,
                  hoverClass: 'group-hover:translate-x-4'
                },
                { 
                  rotation: 'rotate-6',
                  left: 100,
                  zIndex: 30,
                  hoverClass: 'group-hover:translate-x-8'
                },
              ];
              
              const style = coverStyles[index];
              
              return (
                <div
                  key={calibreId}
                  className="absolute transition-all duration-300 group-hover:scale-105"
                  style={{
                    left: `${style.left}px`,
                    zIndex: style.zIndex,
                  }}
                >
                  <div className={`${style.rotation} transition-transform duration-300 ${style.hoverClass}`}>
                    <Image
                      src={`/api/books/${calibreId}/cover`}
                      alt={`Cover ${index + 1}`}
                      width={80}
                      height={120}
                      className="rounded shadow-xl border-2 border-[var(--card-bg)]"
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
        <p className="text-sm text-[var(--subheading-text)] font-medium">
          {bookCount} {bookCount === 1 ? 'book' : 'books'}
        </p>
      </div>
    </Link>
  );
}
