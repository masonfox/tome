/**
 * OPDS Series Navigation Feed Endpoint
 * Returns navigation feed listing all series with book counts
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateOPDSAuth, createUnauthorizedResponse } from '@/lib/opds/auth';
import { generateNavigationFeed } from '@/lib/opds/generator';
import { OPDS_MIME_TYPES, OPDS_REL_TYPES } from '@/lib/opds/constants';
import { buildOPDSUrl } from '@/lib/opds/helpers';
import { getAllSeries } from '@/lib/db/calibre';
import type { OPDSFeed, OPDSEntry } from '@/lib/opds/types';
import { getLogger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Validate HTTP Basic Auth
    if (!validateOPDSAuth(request)) {
      return createUnauthorizedResponse();
    }

    // Get all series with book counts from Calibre
    const series = getAllSeries();
    const now = new Date().toISOString();

    // Build navigation feed entries (one per series)
    const entries: OPDSEntry[] = series.map(s => ({
      id: `urn:tome:series:${encodeURIComponent(s.name)}`,
      title: s.name,
      updated: now,
      content: {
        type: 'text',
        text: `${s.bookCount} book${s.bookCount !== 1 ? 's' : ''}`,
      },
      authors: [{ name: 'Tome' }],
      links: [
        {
          rel: OPDS_REL_TYPES.SUBSECTION,
          href: buildOPDSUrl(`/series/${encodeURIComponent(s.name)}`),
          type: OPDS_MIME_TYPES.ACQUISITION_FEED,
          count: s.bookCount,
        },
      ],
    }));

    // Build navigation feed
    const feed: OPDSFeed = {
      id: 'urn:tome:by-series',
      title: 'Browse by Series',
      updated: now,
      subtitle: 'Browse books organized by series',
      links: [
        {
          rel: OPDS_REL_TYPES.SELF,
          href: buildOPDSUrl('/series'),
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
        'Cache-Control': 'public, max-age=300', // 5 minutes
      },
    });
  } catch (error) {
    getLogger().error({ err: error }, 'OPDS series navigation endpoint error');
    return NextResponse.json(
      { error: 'Failed to fetch series' },
      { status: 500 }
    );
  }
}
