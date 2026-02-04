/**
 * OpenSearch Description Document
 * Provides search interface description for OPDS clients
 * Required by some clients like Foliate for search functionality
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateOPDSAuth, createUnauthorizedResponse } from '@/lib/opds/auth';
import { buildOPDSUrl } from '@/lib/opds/helpers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Validate HTTP Basic Auth
  if (!validateOPDSAuth(request)) {
    return createUnauthorizedResponse();
  }

  // Generate OpenSearch Description Document
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/">
  <ShortName>Tome Library</ShortName>
  <Description>Search books in your Tome library</Description>
  <Tags>opds calibre books</Tags>
  <Url type="application/atom+xml;profile=opds-catalog;kind=acquisition"
       template="${buildOPDSUrl('/search?q={searchTerms}')}" />
  <Query role="example" searchTerms="science fiction" />
  <Developer>Tome</Developer>
  <Language>en-us</Language>
  <OutputEncoding>UTF-8</OutputEncoding>
  <InputEncoding>UTF-8</InputEncoding>
</OpenSearchDescription>`;

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/opensearchdescription+xml',
      'Cache-Control': 'public, max-age=86400', // 24 hours
    },
  });
}
