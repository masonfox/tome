/**
 * OPDS Books by Rating Acquisition Feed Endpoint
 * Returns books filtered by star rating with download links and pagination
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateOPDSAuth, createUnauthorizedResponse } from '@/lib/opds/auth';
import { generateAcquisitionFeed } from '@/lib/opds/generator';
import { OPDS_MIME_TYPES, OPDS_PAGE_SIZE, OPDS_MAX_PAGE_SIZE } from '@/lib/opds/constants';
import {
  parsePaginationParams,
  buildPaginationLinks,
  buildBookEntry,
} from '@/lib/opds/helpers';
import { getBooksByRating } from '@/lib/opds/tome-integration';
import { getAllBookFormats } from '@/lib/db/calibre';
import type { OPDSFeed } from '@/lib/opds/types';
import { getLogger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const VALID_RATINGS = ['rated', 'unrated', '1', '2', '3', '4', '5'];

const RATING_TITLES: Record<string, string> = {
  'rated': 'Rated Books',
  'unrated': 'Unrated Books',
  '1': '★☆☆☆☆ (1 star)',
  '2': '★★☆☆☆ (2 stars)',
  '3': '★★★☆☆ (3 stars)',
  '4': '★★★★☆ (4 stars)',
  '5': '★★★★★ (5 stars)',
};

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ rating: string }> }
) {
  try {
    // Validate HTTP Basic Auth
    if (!validateOPDSAuth(request)) {
      return createUnauthorizedResponse();
    }

    // Get rating from route params
    const params = await props.params;
    const ratingParam = params.rating;

    // Validate rating
    if (!VALID_RATINGS.includes(ratingParam)) {
      return NextResponse.json(
        { error: 'Invalid rating. Must be one of: unrated, 1, 2, 3, 4, 5' },
        { status: 400 }
      );
    }

    // Parse pagination parameters
    const { offset, limit } = parsePaginationParams(
      request.nextUrl.searchParams,
      OPDS_PAGE_SIZE,
      OPDS_MAX_PAGE_SIZE
    );

    // Convert rating to number, 'unrated', or 'rated'
    const rating: number | 'unrated' | 'rated' = 
      (ratingParam === 'unrated' || ratingParam === 'rated') 
        ? ratingParam 
        : parseInt(ratingParam, 10);

    // Get books by rating from Calibre database
    const { books, total } = await getBooksByRating(rating, limit, offset);
    const bookIds = books.map(b => b.id);

    // Bulk fetch formats (single query instead of N queries)
    const formatsMap = getAllBookFormats(bookIds);

    // Build OPDS entries using shared helper
    const entries = books.map(book => buildBookEntry(book, formatsMap));

    // Build pagination links
    const paginationLinks = buildPaginationLinks(
      `/ratings/${ratingParam}`,
      offset,
      limit,
      total,
      OPDS_MIME_TYPES.ACQUISITION_FEED
    );

    // Build feed
    const feed: OPDSFeed = {
      id: `urn:tome:rating:${ratingParam}`,
      title: RATING_TITLES[ratingParam],
      updated: new Date().toISOString(),
      subtitle: `${total} book${total !== 1 ? 's' : ''}`,
      totalResults: total,
      itemsPerPage: limit,
      startIndex: offset,
      links: paginationLinks,
      entries,
    };

    // Generate and return XML
    const xml = generateAcquisitionFeed(feed);
    return new NextResponse(xml, {
      headers: {
        'Content-Type': OPDS_MIME_TYPES.ACQUISITION_FEED,
        'Cache-Control': 'public, max-age=60', // 1 minute (ratings can change)
      },
    });
  } catch (error) {
    getLogger().error({ err: error }, 'OPDS books by rating endpoint error');
    return NextResponse.json(
      { error: 'Failed to fetch books by rating' },
      { status: 500 }
    );
  }
}
