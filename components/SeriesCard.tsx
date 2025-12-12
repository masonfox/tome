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
      className="group block bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden"
    >
      {/* Cover Collage Section */}
      <div className="relative h-[180px] bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 overflow-hidden">
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
                      className="rounded shadow-lg border-2 border-white dark:border-gray-600"
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
            <BookMarked className="w-16 h-16 text-gray-400 dark:text-gray-500" />
          </div>
        )}
      </div>

      {/* Series Info Section */}
      <div className="p-4">
        <h3 className="font-semibold text-lg text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2 mb-2">
          {name}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {bookCount} {bookCount === 1 ? 'book' : 'books'}
        </p>
      </div>
    </Link>
  );
}
