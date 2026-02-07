/**
 * OPDS Search Endpoint
 * Searches books by title and author
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateOPDSAuth, createUnauthorizedResponse } from '@/lib/opds/auth';
import { generateAcquisitionFeed } from '@/lib/opds/generator';
import { OPDS_MIME_TYPES, OPDS_REL_TYPES, OPDS_PAGE_SIZE, OPDS_MAX_PAGE_SIZE } from '@/lib/opds/constants';
import { parsePaginationParams, buildPaginationLinks, buildOPDSUrl, getMimeTypeForFormat, toAtomDate } from '@/lib/opds/helpers';
import { searchBooks, getAllBookFormats } from '@/lib/db/calibre';
import type { OPDSFeed, OPDSEntry } from '@/lib/opds/types';
import { getLogger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Validate HTTP Basic Auth
    if (!validateOPDSAuth(request)) {
      return createUnauthorizedResponse();
    }

    // Parse search query
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');

    if (!query || query.trim() === '') {
      return NextResponse.json(
        { error: 'Search query required' },
        { status: 400 }
      );
    }

    // Parse pagination parameters
    const { offset, limit } = parsePaginationParams(
      searchParams,
      OPDS_PAGE_SIZE,
      OPDS_MAX_PAGE_SIZE
    );

    // Search Calibre database
    const allResults = searchBooks(query);
    const totalResults = allResults.length;
    const books = allResults.slice(offset, offset + limit);
    const bookIds = books.map(b => b.id);

    // Bulk fetch formats
    const formatsMap = getAllBookFormats(bookIds);

    // Build OPDS entries (same logic as books endpoint)
    const entries: OPDSEntry[] = books.map(book => {
      const formats = formatsMap.get(book.id) || [];

      // Build acquisition links for each format
      const acquisitionLinks = formats.map(fmt => ({
        rel: OPDS_REL_TYPES.ACQUISITION,
        href: buildOPDSUrl(`/download/${book.id}/${fmt.format.toLowerCase()}`),
        type: getMimeTypeForFormat(fmt.format),
        title: `Download ${fmt.format}`,
      }));

      // Build cover link if book has cover
      const coverLinks = book.has_cover
        ? [
            {
              rel: OPDS_REL_TYPES.COVER,
              href: `/api/covers/${book.id}`,
              type: 'image/jpeg',
            },
            {
              rel: OPDS_REL_TYPES.THUMBNAIL,
              href: `/api/covers/${book.id}`,
              type: 'image/jpeg',
            },
          ]
        : [];

      // Parse authors
      const authors = book.authors
        ? book.authors.split(',').map(name => ({ name: name.trim() }))
        : [{ name: 'Unknown' }];

      // Build entry
      const entry: OPDSEntry = {
        id: `urn:tome:book:${book.id}`,
        title: book.title,
        updated: toAtomDate(book.timestamp),
        authors,
        links: [...coverLinks, ...acquisitionLinks],
      };

      // Add description if available
      if (book.description) {
        entry.content = {
          type: 'text',
          text: book.description,
        };
      }

      // Add published date if available
      if (book.pubdate) {
        entry.published = toAtomDate(book.pubdate);
      }

      // Add series as category if available
      if (book.series) {
        entry.categories = [
          {
            term: book.series,
            label: `Series: ${book.series}`,
          },
        ];
      }

      // Add DC terms
      entry.dcterms = {};
      if (book.publisher) {
        entry.dcterms.publisher = book.publisher;
      }
      if (book.pubdate) {
        entry.dcterms.issued = toAtomDate(book.pubdate);
      }
      if (book.isbn) {
        entry.dcterms.identifier = `urn:isbn:${book.isbn}`;
      }

      return entry;
    });

    // Build pagination links with query parameter
    const paginationLinks = buildPaginationLinks(
      '/search',
      offset,
      limit,
      totalResults,
      OPDS_MIME_TYPES.ACQUISITION_FEED,
      { q: query }
    );

    // Build feed
    const feed: OPDSFeed = {
      id: `urn:tome:search:${encodeURIComponent(query)}`,
      title: `Search results for "${query}"`,
      updated: new Date().toISOString(),
      totalResults,
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
        'Cache-Control': 'public, max-age=60', // 1 minute (shorter for search)
      },
    });
  } catch (error) {
    getLogger().error({ err: error }, 'OPDS search endpoint error');
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    );
  }
}
