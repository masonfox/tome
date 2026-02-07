/**
 * OPDS Books by Tag Acquisition Feed Endpoint
 * Returns books with a specific tag with download links and pagination
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
import { getBooksByTag, getAllBookFormats } from '@/lib/db/calibre';
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

    // Get tag name from route params
    const params = await props.params;
    const tagName = decodeURIComponent(params.name);

    // Parse pagination parameters
    const { offset, limit } = parsePaginationParams(
      request.nextUrl.searchParams,
      OPDS_PAGE_SIZE,
      OPDS_MAX_PAGE_SIZE
    );

    // Get books by tag from Calibre
    const allBooks = getBooksByTag(tagName);
    const totalBooks = allBooks.length;

    // Apply pagination
    const books = getBooksByTag(tagName, { limit, offset });
    const bookIds = books.map(b => b.id);

    // Bulk fetch formats (single query instead of N queries)
    const formatsMap = getAllBookFormats(bookIds);

    // Build OPDS entries using shared helper
    const entries = books.map(book => buildBookEntry(book, formatsMap));

    // Build pagination links
    const paginationLinks = buildPaginationLinks(
      `/tags/${encodeURIComponent(tagName)}`,
      offset,
      limit,
      totalBooks,
      OPDS_MIME_TYPES.ACQUISITION_FEED
    );

    // Build feed
    const feed: OPDSFeed = {
      id: `urn:tome:tag:${encodeURIComponent(tagName)}`,
      title: `Books tagged: ${tagName}`,
      updated: new Date().toISOString(),
      subtitle: `${totalBooks} book${totalBooks !== 1 ? 's' : ''} with tag "${tagName}"`,
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
    getLogger().error({ err: error }, 'OPDS books by tag endpoint error');
    return NextResponse.json(
      { error: 'Failed to fetch books by tag' },
      { status: 500 }
    );
  }
}
