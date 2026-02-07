/**
 * OPDS Books by Series Acquisition Feed Endpoint
 * Returns books in a specific series with download links and pagination
 * Books are ordered by series_index for proper reading order
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
import { getBooksBySeries, getAllBookFormats } from '@/lib/db/calibre';
import type { OPDSFeed } from '@/lib/opds/types';
import { getLogger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ name: string }> }
) {
  try {
    // Validate HTTP Basic Auth
    if (!validateOPDSAuth(request)) {
      return createUnauthorizedResponse();
    }

    // Get series name from route params
    const params = await props.params;
    const seriesName = decodeURIComponent(params.name);

    // Parse pagination parameters
    const { offset, limit } = parsePaginationParams(
      request.nextUrl.searchParams,
      OPDS_PAGE_SIZE,
      OPDS_MAX_PAGE_SIZE
    );

    // Get books by series from Calibre
    const allBooks = getBooksBySeries(seriesName);
    const totalBooks = allBooks.length;

    // Apply pagination
    const books = getBooksBySeries(seriesName, { limit, offset });
    const bookIds = books.map(b => b.id);

    // Bulk fetch formats (single query instead of N queries)
    const formatsMap = getAllBookFormats(bookIds);

    // Build OPDS entries using shared helper
    const entries = books.map(book => buildBookEntry(book, formatsMap));

    // Build pagination links
    const paginationLinks = buildPaginationLinks(
      `/series/${encodeURIComponent(seriesName)}`,
      offset,
      limit,
      totalBooks,
      OPDS_MIME_TYPES.ACQUISITION_FEED
    );

    // Build feed
    const feed: OPDSFeed = {
      id: `urn:tome:series:${encodeURIComponent(seriesName)}`,
      title: seriesName,
      updated: new Date().toISOString(),
      subtitle: `${totalBooks} book${totalBooks !== 1 ? 's' : ''} in series`,
      totalResults: totalBooks,
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
        'Cache-Control': 'public, max-age=300', // 5 minutes
      },
    });
  } catch (error) {
    getLogger().error({ err: error }, 'OPDS books by series endpoint error');
    return NextResponse.json(
      { error: 'Failed to fetch books by series' },
      { status: 500 }
    );
  }
}
