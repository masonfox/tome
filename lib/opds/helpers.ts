/**
 * OPDS Helper Functions
 * Utility functions for URL building and format handling
 */

import { FORMAT_PRIORITY, FORMAT_MIME_TYPES } from './constants';

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
 */
export function buildPaginationLinks(
  basePath: string,
  offset: number,
  limit: number,
  total: number,
  mimeType: string,
  additionalParams?: Record<string, string>
): Array<{ rel: string; href: string; type: string }> {
  const links: Array<{ rel: string; href: string; type: string }> = [];

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

  return links;
}
