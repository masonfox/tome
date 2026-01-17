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
