/**
 * OPDS Ratings Navigation Feed Endpoint
 * Returns navigation feed with rating options (unrated, 1-5 stars)
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateOPDSAuth, createUnauthorizedResponse } from '@/lib/opds/auth';
import { generateNavigationFeed } from '@/lib/opds/generator';
import { OPDS_MIME_TYPES, OPDS_REL_TYPES } from '@/lib/opds/constants';
import { buildOPDSUrl, buildSearchLinks } from '@/lib/opds/helpers';
import type { OPDSFeed, OPDSEntry } from '@/lib/opds/types';
import { getLogger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Validate HTTP Basic Auth
    if (!validateOPDSAuth(request)) {
      return createUnauthorizedResponse();
    }

    const now = new Date().toISOString();

    // Define rating options
    const ratingOptions = [
      {
        id: 'rated',
        title: 'Rated',
        description: 'All books with a rating (1-5 stars)',
      },
      {
        id: '1',
        title: '★☆☆☆☆ (1 star)',
        description: 'Books rated 1 star',
      },
      {
        id: '2',
        title: '★★☆☆☆ (2 stars)',
        description: 'Books rated 2 stars',
      },
      {
        id: '3',
        title: '★★★☆☆ (3 stars)',
        description: 'Books rated 3 stars',
      },
      {
        id: '4',
        title: '★★★★☆ (4 stars)',
        description: 'Books rated 4 stars',
      },
      {
        id: '5',
        title: '★★★★★ (5 stars)',
        description: 'Books rated 5 stars',
      },
    ];

    // Build navigation feed entries (one per rating option)
    const entries: OPDSEntry[] = ratingOptions.map(rating => ({
      id: `urn:tome:rating:${rating.id}`,
      title: rating.title,
      updated: now,
      content: {
        type: 'text',
        text: rating.description,
      },
      authors: [{ name: 'Tome' }],
      links: [
        {
          rel: OPDS_REL_TYPES.SUBSECTION,
          href: buildOPDSUrl(`/ratings/${rating.id}`),
          type: OPDS_MIME_TYPES.ACQUISITION_FEED,
        },
      ],
    }));

    // Build navigation feed
    const feed: OPDSFeed = {
      id: 'urn:tome:by-rating',
      title: 'Ratings',
      updated: now,
      subtitle: 'Filter books by star rating',
      links: [
        {
          rel: OPDS_REL_TYPES.SELF,
          href: buildOPDSUrl('/ratings'),
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
        'Cache-Control': 'public, max-age=300', // 5 minutes (ratings structure is static)
      },
    });
  } catch (error) {
    getLogger().error({ err: error }, 'OPDS ratings navigation endpoint error');
    return NextResponse.json(
      { error: 'Failed to fetch rating options' },
      { status: 500 }
    );
  }
}
