/**
 * OPDS Status Navigation Feed Endpoint
 * Returns navigation feed with reading status options (to-read, reading, read, etc.)
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateOPDSAuth, createUnauthorizedResponse } from '@/lib/opds/auth';
import { generateNavigationFeed } from '@/lib/opds/generator';
import { OPDS_MIME_TYPES, OPDS_REL_TYPES } from '@/lib/opds/constants';
import { buildOPDSUrl } from '@/lib/opds/helpers';
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

    // Define status options
    const statusOptions = [
      {
        id: 'to-read',
        title: 'To Read',
        description: 'Books you plan to read',
      },
      {
        id: 'read-next',
        title: 'Read Next',
        description: 'Your reading queue',
      },
      {
        id: 'reading',
        title: 'Reading',
        description: 'Books in progress',
      },
      {
        id: 'read',
        title: 'Read',
        description: 'Completed books',
      },
      {
        id: 'dnf',
        title: 'Did Not Finish',
        description: 'Abandoned books',
      },
    ];

    // Build navigation feed entries (one per status option)
    const entries: OPDSEntry[] = statusOptions.map(status => ({
      id: `urn:tome:status:${status.id}`,
      title: status.title,
      updated: now,
      content: {
        type: 'text',
        text: status.description,
      },
      authors: [{ name: 'Tome' }],
      links: [
        {
          rel: OPDS_REL_TYPES.SUBSECTION,
          href: buildOPDSUrl(`/status/${status.id}`),
          type: OPDS_MIME_TYPES.ACQUISITION_FEED,
        },
      ],
    }));

    // Build navigation feed
    const feed: OPDSFeed = {
      id: 'urn:tome:by-status',
      title: 'Reading Status',
      updated: now,
      subtitle: 'Filter books by reading status',
      links: [
        {
          rel: OPDS_REL_TYPES.SELF,
          href: buildOPDSUrl('/status'),
          type: OPDS_MIME_TYPES.NAVIGATION_FEED,
        },
        {
          rel: OPDS_REL_TYPES.START,
          href: buildOPDSUrl(''),
          type: OPDS_MIME_TYPES.NAVIGATION_FEED,
        },
      ],
      entries,
    };

    // Generate and return XML
    const xml = generateNavigationFeed(feed);
    return new NextResponse(xml, {
      headers: {
        'Content-Type': OPDS_MIME_TYPES.NAVIGATION_FEED,
        'Cache-Control': 'public, max-age=60', // 1 minute (more dynamic than facets)
      },
    });
  } catch (error) {
    getLogger().error({ err: error }, 'OPDS status navigation endpoint error');
    return NextResponse.json(
      { error: 'Failed to fetch status options' },
      { status: 500 }
    );
  }
}
