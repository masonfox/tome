/**
 * OPDS Shelves Navigation Feed Endpoint
 * Returns navigation feed listing all user shelves with book counts
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateOPDSAuth, createUnauthorizedResponse } from '@/lib/opds/auth';
import { generateNavigationFeed } from '@/lib/opds/generator';
import { OPDS_MIME_TYPES, OPDS_REL_TYPES } from '@/lib/opds/constants';
import { buildOPDSUrl } from '@/lib/opds/helpers';
import { getAllShelves } from '@/lib/opds/tome-integration';
import type { OPDSFeed, OPDSEntry } from '@/lib/opds/types';
import { getLogger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Validate HTTP Basic Auth
    if (!validateOPDSAuth(request)) {
      return createUnauthorizedResponse();
    }

    // Get all shelves from Tome database
    const shelves = await getAllShelves();
    const now = new Date().toISOString();

    // Build navigation feed entries (one per shelf)
    const entries: OPDSEntry[] = shelves.map(shelf => ({
      id: `urn:tome:shelf:${shelf.id}`,
      title: shelf.name,
      updated: now,
      content: {
        type: 'text',
        text: shelf.description || `${shelf.bookCount} book${shelf.bookCount !== 1 ? 's' : ''}`,
      },
      authors: [{ name: 'Tome' }],
      links: [
        {
          rel: OPDS_REL_TYPES.SUBSECTION,
          href: buildOPDSUrl(`/shelves/${shelf.id}`),
          type: OPDS_MIME_TYPES.ACQUISITION_FEED,
          count: shelf.bookCount,
        },
      ],
    }));

    // Build navigation feed
    const feed: OPDSFeed = {
      id: 'urn:tome:shelves',
      title: 'Browse by Shelf',
      updated: now,
      subtitle: 'Browse your custom book shelves',
      links: [
        {
          rel: OPDS_REL_TYPES.SELF,
          href: buildOPDSUrl('/shelves'),
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
    getLogger().error({ err: error }, 'OPDS shelves navigation endpoint error');
    return NextResponse.json(
      { error: 'Failed to fetch shelves' },
      { status: 500 }
    );
  }
}
