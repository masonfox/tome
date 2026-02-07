/**
 * OPDS Helper Functions
 * Utility functions for URL building and format handling
 */

import { FORMAT_PRIORITY, FORMAT_MIME_TYPES, OPDS_MIME_TYPES, OPDS_REL_TYPES } from './constants';
import type { OPDSEntry, OPDSLink } from './types';
import type { CalibreBook, CalibreBookFormat } from '../db/calibre';

/**
 * Build a full URL path for OPDS endpoints
 */
export function buildOPDSUrl(path: string, params?: Record<string, string | number>): string {
  const url = `/api/opds${path}`;

  if (!params || Object.keys(params).length === 0) {
    return url;
  }

  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    searchParams.append(key, String(value));
  });

  return `${url}?${searchParams.toString()}`;
}

/**
 * Sort formats by priority (EPUB first, then others)
 */
export function sortFormatsByPriority(formats: Array<{ format: string }>): Array<{ format: string }> {
  return formats.sort((a, b) => {
    const priorityA = FORMAT_PRIORITY[a.format] || 999;
    const priorityB = FORMAT_PRIORITY[b.format] || 999;
    return priorityA - priorityB;
  });
}

/**
 * Get MIME type for a book format
 */
export function getMimeTypeForFormat(format: string): string {
  return FORMAT_MIME_TYPES[format] || 'application/octet-stream';
}

/**
 * Convert ISO date string to Atom-compatible format
 */
export function toAtomDate(date: string | Date): string {
  if (typeof date === 'string') {
    // Try to parse as date
    const parsed = new Date(date);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
    return new Date().toISOString();
  }
  return date.toISOString();
}

/**
 * Build standard search links for OPDS feeds
 * Returns search links to be included in any feed
 */
export function buildSearchLinks(): OPDSLink[] {
  return [
    {
      rel: OPDS_REL_TYPES.SEARCH,
      href: buildOPDSUrl('/search?q={searchTerms}'),
      type: OPDS_MIME_TYPES.ACQUISITION_FEED,
      title: 'Search Books',
    },
    {
      rel: OPDS_REL_TYPES.SEARCH,
      href: buildOPDSUrl('/opensearch.xml'),
      type: 'application/opensearchdescription+xml',
      title: 'Search Books',
    },
  ];
}

/**
 * Parse pagination parameters from query string
 */
export function parsePaginationParams(
  searchParams: URLSearchParams,
  defaultLimit: number = 50,
  maxLimit: number = 200
): { offset: number; limit: number } {
  const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10) || 0);

  const limitParam = searchParams.get('limit');
  const parsedLimit = limitParam ? parseInt(limitParam, 10) : defaultLimit;
  const limit = Math.min(
    maxLimit,
    Math.max(1, isNaN(parsedLimit) ? defaultLimit : parsedLimit)
  );

  return { offset, limit };
}

/**
 * Build pagination links for OPDS feeds
 * Automatically includes search links unless disabled
 */
export function buildPaginationLinks(
  basePath: string,
  offset: number,
  limit: number,
  total: number,
  mimeType: string,
  additionalParams?: Record<string, string>,
  includeSearch: boolean = true
): OPDSLink[] {
  const links: OPDSLink[] = [];

  // Self link
  links.push({
    rel: 'self',
    href: buildOPDSUrl(basePath, { ...additionalParams, offset, limit }),
    type: mimeType,
  });

  // Start link
  links.push({
    rel: 'start',
    href: buildOPDSUrl(''),
    type: 'application/atom+xml;profile=opds-catalog;kind=navigation',
  });

  // Next link
  if (offset + limit < total) {
    links.push({
      rel: 'next',
      href: buildOPDSUrl(basePath, { ...additionalParams, offset: offset + limit, limit }),
      type: mimeType,
    });
  }

  // Previous link
  if (offset > 0) {
    links.push({
      rel: 'previous',
      href: buildOPDSUrl(basePath, { ...additionalParams, offset: Math.max(0, offset - limit), limit }),
      type: mimeType,
    });
  }

  // Add search links automatically
  if (includeSearch) {
    links.push(...buildSearchLinks());
  }

  return links;
}

/**
 * Build OPDS entry for a single book
 * Reused across all acquisition feeds to ensure consistent book entry structure
 */
export function buildBookEntry(
  book: CalibreBook,
  formatsMap: Map<number, CalibreBookFormat[]>
): OPDSEntry {
  const formats = formatsMap.get(book.id) || [];

  // Build acquisition links for each format
  const acquisitionLinks = formats.map(fmt => ({
    rel: OPDS_REL_TYPES.ACQUISITION,
    href: buildOPDSUrl(`/download/${book.id}/${fmt.format.toLowerCase()}`),
    type: getMimeTypeForFormat(fmt.format),
    title: `Download ${fmt.format}`,
  }));

  // Build cover links if available
  const coverLinks = book.has_cover
    ? [
        { rel: OPDS_REL_TYPES.COVER, href: `/api/covers/${book.id}`, type: 'image/jpeg' },
        { rel: OPDS_REL_TYPES.THUMBNAIL, href: `/api/covers/${book.id}`, type: 'image/jpeg' },
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

  // Add optional fields
  if (book.description) {
    entry.content = { type: 'text', text: book.description };
  }

  if (book.pubdate) {
    entry.published = toAtomDate(book.pubdate);
  }

  if (book.series) {
    entry.categories = [{ term: book.series, label: `Series: ${book.series}` }];
  }

  // Add DC terms
  entry.dcterms = {};
  if (book.publisher) entry.dcterms.publisher = book.publisher;
  if (book.pubdate) entry.dcterms.issued = toAtomDate(book.pubdate);
  if (book.isbn) entry.dcterms.identifier = `urn:isbn:${book.isbn}`;

  return entry;
}
