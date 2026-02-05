/**
 * OPDS Authors Navigation Feed Endpoint
 * Returns navigation feed listing all authors with book counts
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateOPDSAuth, createUnauthorizedResponse } from '@/lib/opds/auth';
import { generateNavigationFeed } from '@/lib/opds/generator';
import { OPDS_MIME_TYPES, OPDS_REL_TYPES } from '@/lib/opds/constants';
import { buildOPDSUrl, buildSearchLinks } from '@/lib/opds/helpers';
import { getAllAuthors } from '@/lib/db/calibre';
import type { OPDSFeed, OPDSEntry } from '@/lib/opds/types';
import { getLogger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Validate HTTP Basic Auth
    if (!validateOPDSAuth(request)) {
      return createUnauthorizedResponse();
    }

    // Get all authors with book counts from Calibre
    const authors = getAllAuthors();
    const now = new Date().toISOString();

    // Build navigation feed entries (one per author)
    const entries: OPDSEntry[] = authors.map(author => ({
      id: `urn:tome:author:${encodeURIComponent(author.name)}`,
      title: author.name,
      updated: now,
      content: {
        type: 'text',
        text: `${author.bookCount} book${author.bookCount !== 1 ? 's' : ''}`,
      },
      authors: [{ name: 'Tome' }],
      links: [
        {
          rel: OPDS_REL_TYPES.SUBSECTION,
          href: buildOPDSUrl(`/authors/${encodeURIComponent(author.name)}`),
          type: OPDS_MIME_TYPES.ACQUISITION_FEED,
          count: author.bookCount,
        },
      ],
    }));

    // Build navigation feed
    const feed: OPDSFeed = {
      id: 'urn:tome:by-author',
      title: 'Author',
      updated: now,
      subtitle: 'Browse books organized by author',
      links: [
        {
          rel: OPDS_REL_TYPES.SELF,
          href: buildOPDSUrl('/authors'),
          type: OPDS_MIME_TYPES.NAVIGATION_FEED,
        },
        {
          rel: OPDS_REL_TYPES.START,
          href: buildOPDSUrl(''),
          type: OPDS_MIME_TYPES.NAVIGATION_FEED,
        },
        ...buildSearchLinks(),
      ],
      entries,
    };

    // Generate and return XML
    const xml = generateNavigationFeed(feed);
    return new NextResponse(xml, {
      headers: {
        'Content-Type': OPDS_MIME_TYPES.NAVIGATION_FEED,
        'Cache-Control': 'public, max-age=300', // 5 minutes
      },
    });
  } catch (error) {
    getLogger().error({ err: error }, 'OPDS authors navigation endpoint error');
    return NextResponse.json(
      { error: 'Failed to fetch authors' },
      { status: 500 }
    );
  }
}
