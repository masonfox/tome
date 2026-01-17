/**
 * Unit tests for OPDS helpers
 */

import { describe, test, expect } from 'vitest';
import {
  buildOPDSUrl,
  sortFormatsByPriority,
  getMimeTypeForFormat,
  toAtomDate,
  parsePaginationParams,
  buildPaginationLinks,
} from '@/lib/opds/helpers';

describe('OPDS Helpers', () => {
  describe('buildOPDSUrl', () => {
    test('should build URL without parameters', () => {
      const url = buildOPDSUrl('/books');
      expect(url).toBe('/api/opds/books');
    });

    test('should build URL with parameters', () => {
      const url = buildOPDSUrl('/books', { offset: 50, limit: 25 });
      expect(url).toBe('/api/opds/books?offset=50&limit=25');
    });

    test('should handle empty parameters object', () => {
      const url = buildOPDSUrl('/books', {});
      expect(url).toBe('/api/opds/books');
    });

    test('should handle root path', () => {
      const url = buildOPDSUrl('');
      expect(url).toBe('/api/opds');
    });
  });

  describe('sortFormatsByPriority', () => {
    test('should prioritize EPUB first', () => {
      const formats = [
        { format: 'PDF' },
        { format: 'EPUB' },
        { format: 'MOBI' },
      ];

      const sorted = sortFormatsByPriority(formats);

      expect(sorted[0].format).toBe('EPUB');
    });

    test('should sort by priority order', () => {
      const formats = [
        { format: 'AZW3' },
        { format: 'PDF' },
        { format: 'KEPUB' },
        { format: 'EPUB' },
        { format: 'MOBI' },
      ];

      const sorted = sortFormatsByPriority(formats);

      expect(sorted[0].format).toBe('EPUB');
      expect(sorted[1].format).toBe('KEPUB');
      expect(sorted[2].format).toBe('PDF');
      expect(sorted[3].format).toBe('MOBI');
      expect(sorted[4].format).toBe('AZW3');
    });

    test('should handle unknown formats', () => {
      const formats = [
        { format: 'UNKNOWN' },
        { format: 'EPUB' },
      ];

      const sorted = sortFormatsByPriority(formats);

      expect(sorted[0].format).toBe('EPUB');
      expect(sorted[1].format).toBe('UNKNOWN');
    });
  });

  describe('getMimeTypeForFormat', () => {
    test('should return correct MIME type for EPUB', () => {
      expect(getMimeTypeForFormat('EPUB')).toBe('application/epub+zip');
    });

    test('should return correct MIME type for PDF', () => {
      expect(getMimeTypeForFormat('PDF')).toBe('application/pdf');
    });

    test('should return correct MIME type for MOBI', () => {
      expect(getMimeTypeForFormat('MOBI')).toBe('application/x-mobipocket-ebook');
    });

    test('should return fallback for unknown format', () => {
      expect(getMimeTypeForFormat('UNKNOWN')).toBe('application/octet-stream');
    });
  });

  describe('toAtomDate', () => {
    test('should convert Date object to ISO string', () => {
      const date = new Date('2024-01-01T12:00:00.000Z');
      const atomDate = toAtomDate(date);
      expect(atomDate).toBe('2024-01-01T12:00:00.000Z');
    });

    test('should convert valid date string to ISO string', () => {
      const atomDate = toAtomDate('2024-01-01');
      expect(atomDate).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    test('should handle invalid date string gracefully', () => {
      const atomDate = toAtomDate('invalid-date');
      expect(atomDate).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });

  describe('parsePaginationParams', () => {
    test('should parse offset and limit from URLSearchParams', () => {
      const searchParams = new URLSearchParams('offset=50&limit=25');
      const { offset, limit } = parsePaginationParams(searchParams);

      expect(offset).toBe(50);
      expect(limit).toBe(25);
    });

    test('should use default limit when not provided', () => {
      const searchParams = new URLSearchParams('offset=50');
      const { offset, limit } = parsePaginationParams(searchParams, 50);

      expect(offset).toBe(50);
      expect(limit).toBe(50);
    });

    test('should use default values when no params provided', () => {
      const searchParams = new URLSearchParams('');
      const { offset, limit } = parsePaginationParams(searchParams);

      expect(offset).toBe(0);
      expect(limit).toBe(50);
    });

    test('should enforce maximum limit', () => {
      const searchParams = new URLSearchParams('limit=1000');
      const { limit } = parsePaginationParams(searchParams, 50, 200);

      expect(limit).toBe(200);
    });

    test('should enforce minimum offset of 0', () => {
      const searchParams = new URLSearchParams('offset=-10');
      const { offset } = parsePaginationParams(searchParams);

      expect(offset).toBe(0);
    });

    test('should enforce minimum limit of 1', () => {
      const searchParams = new URLSearchParams('limit=0');
      const { limit } = parsePaginationParams(searchParams);

      expect(limit).toBe(1);
    });

    test('should handle invalid values gracefully', () => {
      const searchParams = new URLSearchParams('offset=invalid&limit=invalid');
      const { offset, limit } = parsePaginationParams(searchParams, 50);

      expect(offset).toBe(0);
      expect(limit).toBe(50);
    });
  });

  describe('buildPaginationLinks', () => {
    test('should include self and start links', () => {
      const links = buildPaginationLinks('/books', 0, 50, 100, 'application/atom+xml');

      const selfLink = links.find(l => l.rel === 'self');
      const startLink = links.find(l => l.rel === 'start');

      expect(selfLink).toBeDefined();
      expect(selfLink?.href).toBe('/api/opds/books?offset=0&limit=50');

      expect(startLink).toBeDefined();
      expect(startLink?.href).toBe('/api/opds');
    });

    test('should include next link when more results available', () => {
      const links = buildPaginationLinks('/books', 0, 50, 100, 'application/atom+xml');

      const nextLink = links.find(l => l.rel === 'next');
      expect(nextLink).toBeDefined();
      expect(nextLink?.href).toBe('/api/opds/books?offset=50&limit=50');
    });

    test('should not include next link on last page', () => {
      const links = buildPaginationLinks('/books', 50, 50, 100, 'application/atom+xml');

      const nextLink = links.find(l => l.rel === 'next');
      expect(nextLink).toBeUndefined();
    });

    test('should include previous link when not on first page', () => {
      const links = buildPaginationLinks('/books', 50, 50, 100, 'application/atom+xml');

      const prevLink = links.find(l => l.rel === 'previous');
      expect(prevLink).toBeDefined();
      expect(prevLink?.href).toBe('/api/opds/books?offset=0&limit=50');
    });

    test('should not include previous link on first page', () => {
      const links = buildPaginationLinks('/books', 0, 50, 100, 'application/atom+xml');

      const prevLink = links.find(l => l.rel === 'previous');
      expect(prevLink).toBeUndefined();
    });

    test('should include additional parameters in links', () => {
      const links = buildPaginationLinks(
        '/search',
        0,
        50,
        100,
        'application/atom+xml',
        { q: 'test query' }
      );

      const selfLink = links.find(l => l.rel === 'self');
      expect(selfLink?.href).toContain('q=test+query');
    });

    test('should handle edge case when offset + limit equals total', () => {
      const links = buildPaginationLinks('/books', 50, 50, 100, 'application/atom+xml');

      const nextLink = links.find(l => l.rel === 'next');
      expect(nextLink).toBeUndefined();
    });
  });
});
