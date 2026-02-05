/**
 * OPDS Tags Navigation Feed Endpoint
 * Returns navigation feed listing all tags with book counts
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateOPDSAuth, createUnauthorizedResponse } from '@/lib/opds/auth';
import { generateNavigationFeed } from '@/lib/opds/generator';
import { OPDS_MIME_TYPES, OPDS_REL_TYPES } from '@/lib/opds/constants';
import { buildOPDSUrl, buildSearchLinks } from '@/lib/opds/helpers';
import { getCalibreTags } from '@/lib/db/calibre';
import type { OPDSFeed, OPDSEntry } from '@/lib/opds/types';
import { getLogger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Validate HTTP Basic Auth
    if (!validateOPDSAuth(request)) {
      return createUnauthorizedResponse();
    }

    // Get all tags with book counts from Calibre
    const tags = getCalibreTags();
    const now = new Date().toISOString();

    // Build navigation feed entries (one per tag)
    const entries: OPDSEntry[] = tags.map(tag => ({
      id: `urn:tome:tag:${encodeURIComponent(tag.name)}`,
      title: tag.name,
      updated: now,
      content: {
        type: 'text',
        text: `${tag.bookCount} book${tag.bookCount !== 1 ? 's' : ''}`,
      },
      authors: [{ name: 'Tome' }],
      links: [
        {
          rel: OPDS_REL_TYPES.SUBSECTION,
          href: buildOPDSUrl(`/tags/${encodeURIComponent(tag.name)}`),
          type: OPDS_MIME_TYPES.ACQUISITION_FEED,
          count: tag.bookCount,
        },
      ],
    }));

    // Build navigation feed
    const feed: OPDSFeed = {
      id: 'urn:tome:by-tag',
      title: 'Tags',
      updated: now,
      subtitle: 'Browse books by tags and categories',
      links: [
        {
          rel: OPDS_REL_TYPES.SELF,
          href: buildOPDSUrl('/tags'),
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
    getLogger().error({ err: error }, 'OPDS tags navigation endpoint error');
    return NextResponse.json(
      { error: 'Failed to fetch tags' },
      { status: 500 }
    );
  }
}
