/**
 * OPDS Root Catalog Endpoint
 * Returns navigation feed with links to subsections
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateOPDSAuth, createUnauthorizedResponse } from '@/lib/opds/auth';
import { generateNavigationFeed } from '@/lib/opds/generator';
import { OPDS_MIME_TYPES, OPDS_REL_TYPES } from '@/lib/opds/constants';
import { buildOPDSUrl } from '@/lib/opds/helpers';
import type { OPDSFeed } from '@/lib/opds/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Validate HTTP Basic Auth
  if (!validateOPDSAuth(request)) {
    return createUnauthorizedResponse();
  }

  const now = new Date().toISOString();

  // Build root navigation feed
  const feed: OPDSFeed = {
    id: 'urn:tome:root',
    title: 'Tome Library',
    updated: now,
    subtitle: 'Browse and download books from your Calibre library',
    links: [
      {
        rel: OPDS_REL_TYPES.SELF,
        href: buildOPDSUrl(''),
        type: OPDS_MIME_TYPES.NAVIGATION_FEED,
      },
      {
        rel: OPDS_REL_TYPES.START,
        href: buildOPDSUrl(''),
        type: OPDS_MIME_TYPES.NAVIGATION_FEED,
      },
      {
        rel: OPDS_REL_TYPES.SEARCH,
        href: buildOPDSUrl('/search?q={searchTerms}'),
        type: OPDS_MIME_TYPES.ACQUISITION_FEED,
        title: 'Search Books',
      },
    ],
    entries: [
      {
        id: 'urn:tome:all-books',
        title: 'All Books',
        updated: now,
        content: {
          type: 'text',
          text: 'Browse all books in your library',
        },
        authors: [{ name: 'Tome' }],
        links: [
          {
            rel: OPDS_REL_TYPES.SUBSECTION,
            href: buildOPDSUrl('/books'),
            type: OPDS_MIME_TYPES.ACQUISITION_FEED,
          },
        ],
      },
      {
        id: 'urn:tome:recent',
        title: 'Recently Added',
        updated: now,
        content: {
          type: 'text',
          text: 'Browse recently added books',
        },
        authors: [{ name: 'Tome' }],
        links: [
          {
            rel: OPDS_REL_TYPES.SUBSECTION,
            href: buildOPDSUrl('/recent'),
            type: OPDS_MIME_TYPES.ACQUISITION_FEED,
          },
        ],
      },
      {
        id: 'urn:tome:by-author',
        title: 'Browse by Author',
        updated: now,
        content: {
          type: 'text',
          text: 'Browse books organized by author',
        },
        authors: [{ name: 'Tome' }],
        links: [
          {
            rel: OPDS_REL_TYPES.SUBSECTION,
            href: buildOPDSUrl('/authors'),
            type: OPDS_MIME_TYPES.NAVIGATION_FEED,
          },
        ],
      },
      {
        id: 'urn:tome:by-series',
        title: 'Browse by Series',
        updated: now,
        content: {
          type: 'text',
          text: 'Browse books organized by series',
        },
        authors: [{ name: 'Tome' }],
        links: [
          {
            rel: OPDS_REL_TYPES.SUBSECTION,
            href: buildOPDSUrl('/series'),
            type: OPDS_MIME_TYPES.NAVIGATION_FEED,
          },
        ],
      },
      {
        id: 'urn:tome:by-tag',
        title: 'Browse by Tag',
        updated: now,
        content: {
          type: 'text',
          text: 'Browse books by tags and categories',
        },
        authors: [{ name: 'Tome' }],
        links: [
          {
            rel: OPDS_REL_TYPES.SUBSECTION,
            href: buildOPDSUrl('/tags'),
            type: OPDS_MIME_TYPES.NAVIGATION_FEED,
          },
        ],
      },
      {
        id: 'urn:tome:by-status',
        title: 'Browse by Reading Status',
        updated: now,
        content: {
          type: 'text',
          text: 'Filter books by reading progress',
        },
        authors: [{ name: 'Tome' }],
        links: [
          {
            rel: OPDS_REL_TYPES.SUBSECTION,
            href: buildOPDSUrl('/status'),
            type: OPDS_MIME_TYPES.NAVIGATION_FEED,
          },
        ],
      },
      {
        id: 'urn:tome:shelves',
        title: 'Browse by Shelf',
        updated: now,
        content: {
          type: 'text',
          text: 'Browse your custom book shelves',
        },
        authors: [{ name: 'Tome' }],
        links: [
          {
            rel: OPDS_REL_TYPES.SUBSECTION,
            href: buildOPDSUrl('/shelves'),
            type: OPDS_MIME_TYPES.NAVIGATION_FEED,
          },
        ],
      },
    ],
  };

  // Generate XML
  const xml = generateNavigationFeed(feed);

  return new NextResponse(xml, {
    headers: {
      'Content-Type': OPDS_MIME_TYPES.NAVIGATION_FEED,
      'Cache-Control': 'public, max-age=300', // 5 minutes
    },
  });
}
