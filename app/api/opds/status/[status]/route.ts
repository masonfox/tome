/**
 * OPDS Books by Status Acquisition Feed Endpoint
 * Returns books filtered by reading status with download links and pagination
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
import { getBooksByStatus, type ReadingStatus } from '@/lib/opds/tome-integration';
import { getAllBookFormats } from '@/lib/db/calibre';
import type { OPDSFeed } from '@/lib/opds/types';
import { getLogger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const VALID_STATUSES: ReadingStatus[] = ['to-read', 'reading', 'read', 'read-next', 'dnf'];

const STATUS_TITLES: Record<ReadingStatus, string> = {
  'to-read': 'To Read',
  'read-next': 'Read Next',
  'reading': 'Currently Reading',
  'read': 'Finished',
  'dnf': 'Did Not Finish',
};

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ status: string }> }
) {
  try {
    // Validate HTTP Basic Auth
    if (!validateOPDSAuth(request)) {
      return createUnauthorizedResponse();
    }

    // Get status from route params
    const params = await props.params;
    const status = params.status as ReadingStatus;

    // Validate status
    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be one of: to-read, reading, read, read-next, dnf' },
        { status: 400 }
      );
    }

    // Parse pagination parameters
    const { offset, limit } = parsePaginationParams(
      request.nextUrl.searchParams,
      OPDS_PAGE_SIZE,
      OPDS_MAX_PAGE_SIZE
    );

    // Get books by status using Tome integration
    const { books, total } = await getBooksByStatus(status, limit, offset);
    const bookIds = books.map(b => b.id);

    // Bulk fetch formats (single query instead of N queries)
    const formatsMap = getAllBookFormats(bookIds);

    // Build OPDS entries using shared helper
    const entries = books.map(book => buildBookEntry(book, formatsMap));

    // Build pagination links
    const paginationLinks = buildPaginationLinks(
      `/status/${status}`,
      offset,
      limit,
      total,
      OPDS_MIME_TYPES.ACQUISITION_FEED
    );

    // Build feed
    const feed: OPDSFeed = {
      id: `urn:tome:status:${status}`,
      title: STATUS_TITLES[status],
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
        'Cache-Control': 'public, max-age=60', // 1 minute (more dynamic)
      },
    });
  } catch (error) {
    getLogger().error({ err: error }, 'OPDS books by status endpoint error');
    return NextResponse.json(
      { error: 'Failed to fetch books by status' },
      { status: 500 }
    );
  }
}
