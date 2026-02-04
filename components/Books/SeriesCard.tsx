'use client';

import Link from 'next/link';
import FannedBookCovers from '@/components/Utilities/FannedBookCovers';

interface SeriesCardProps {
  name: string;
  bookCount: number;
  bookCoverIds: number[];
}

/**
 * SeriesCard - Display a series with overlapping book covers
 * Shows book covers in a fanned/stacked layout with hover effects
 */
export default function SeriesCard({ name, bookCount, bookCoverIds }: SeriesCardProps) {
  return (
    <Link
      href={`/series/${encodeURIComponent(name)}`}
      className="group block bg-[var(--card-bg)] border-2 border-[var(--border-color)] rounded-lg shadow-md hover:shadow-xl hover:border-[var(--accent)] transition-all duration-300 overflow-hidden"
    >
      {/* Cover Collage Section */}
      <FannedBookCovers
        coverIds={bookCoverIds}
        size="md"
        maxCovers={12}
        className="bg-gradient-to-br from-amber-50/50 to-orange-300/20 [html[data-theme='dark']_&]:from-stone-500/40 [html[data-theme='dark']_&]:to-stone-700/30"
        height={180}
      />

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
