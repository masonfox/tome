/**
 * OPDS Books by Shelf Acquisition Feed Endpoint
 * Returns books on a specific shelf with download links and pagination
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
import { getBooksByShelf, getAllShelves } from '@/lib/opds/tome-integration';
import { getAllBookFormats } from '@/lib/db/calibre';
import type { OPDSFeed } from '@/lib/opds/types';
import { getLogger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    // Validate HTTP Basic Auth
    if (!validateOPDSAuth(request)) {
      return createUnauthorizedResponse();
    }

    // Get shelf ID from route params
    const params = await props.params;
    const shelfId = parseInt(params.id, 10);

    // Validate shelf ID
    if (isNaN(shelfId) || shelfId <= 0) {
      return NextResponse.json(
        { error: 'Invalid shelf ID' },
        { status: 400 }
      );
    }

    // Parse pagination parameters
    const { offset, limit } = parsePaginationParams(
      request.nextUrl.searchParams,
      OPDS_PAGE_SIZE,
      OPDS_MAX_PAGE_SIZE
    );

    // Get books on shelf using Tome integration
    const { books, total } = await getBooksByShelf(shelfId, limit, offset);
    const bookIds = books.map(b => b.id);

    // Bulk fetch formats (single query instead of N queries)
    const formatsMap = getAllBookFormats(bookIds);

    // Build OPDS entries using shared helper
    const entries = books.map(book => buildBookEntry(book, formatsMap));

    // Get shelf info for title
    const shelves = await getAllShelves();
    const shelf = shelves.find(s => s.id === shelfId);
    const shelfName = shelf?.name || `Shelf ${shelfId}`;

    // Build pagination links
    const paginationLinks = buildPaginationLinks(
      `/shelves/${shelfId}`,
      offset,
      limit,
      total,
      OPDS_MIME_TYPES.ACQUISITION_FEED
    );

    // Build feed
    const feed: OPDSFeed = {
      id: `urn:tome:shelf:${shelfId}`,
      title: shelfName,
      updated: new Date().toISOString(),
      subtitle: shelf?.description || `${total} book${total !== 1 ? 's' : ''} on shelf`,
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
        'Cache-Control': 'public, max-age=60', // 1 minute (more dynamic)
      },
    });
  } catch (error) {
    getLogger().error({ err: error }, 'OPDS books by shelf endpoint error');
    return NextResponse.json(
      { error: 'Failed to fetch books by shelf' },
      { status: 500 }
    );
  }
}
