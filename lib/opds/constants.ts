/**
 * OPDS Constants
 * MIME types, namespaces, and relation types for OPDS 1.2
 */

export const OPDS_MIME_TYPES = {
  ACQUISITION_FEED: 'application/atom+xml;profile=opds-catalog;kind=acquisition',
  NAVIGATION_FEED: 'application/atom+xml;profile=opds-catalog;kind=navigation',
  ENTRY: 'application/atom+xml;type=entry;profile=opds-catalog',
} as const;

export const OPDS_NAMESPACES = {
  ATOM: 'http://www.w3.org/2005/Atom',
  OPDS: 'http://opds-spec.org/2010/catalog',
  DC: 'http://purl.org/dc/terms/',
  OPENSEARCH: 'http://a9.com/-/spec/opensearch/1.1/',
} as const;

export const OPDS_REL_TYPES = {
  SELF: 'self',
  START: 'start',
  NEXT: 'next',
  PREV: 'previous',
  ACQUISITION: 'http://opds-spec.org/acquisition',
  ACQUISITION_OPEN: 'http://opds-spec.org/acquisition/open-access',
  COVER: 'http://opds-spec.org/image',
  THUMBNAIL: 'http://opds-spec.org/image/thumbnail',
  SEARCH: 'search',
  SUBSECTION: 'subsection',
} as const;

export const FORMAT_MIME_TYPES: Record<string, string> = {
  'EPUB': 'application/epub+zip',
  'PDF': 'application/pdf',
  'MOBI': 'application/x-mobipocket-ebook',
  'AZW3': 'application/vnd.amazon.ebook',
  'AZW': 'application/vnd.amazon.ebook',
  'KEPUB': 'application/kepub+zip',
  'CBZ': 'application/vnd.comicbook+zip',
  'CBR': 'application/vnd.comicbook-rar',
  'FB2': 'application/fb2+xml',
  'DJVU': 'image/vnd.djvu',
} as const;

// Default pagination size (matches existing API patterns)
export const OPDS_PAGE_SIZE = 50;

// Maximum pagination size (prevent abuse)
export const OPDS_MAX_PAGE_SIZE = 200;

// Format priority order (EPUB is always preferred)
export const FORMAT_PRIORITY: Record<string, number> = {
  'EPUB': 1,
  'KEPUB': 2,
  'PDF': 3,
  'MOBI': 4,
  'AZW3': 5,
  'AZW': 6,
  'CBZ': 7,
  'CBR': 8,
  'FB2': 9,
  'DJVU': 10,
} as const;
