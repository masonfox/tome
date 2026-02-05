/**
 * Unit tests for OPDS feed generator
 */

import { describe, test, expect } from 'vitest';
import { generateNavigationFeed, generateAcquisitionFeed } from '@/lib/opds/generator';
import type { OPDSFeed } from '@/lib/opds/types';

describe('OPDS Generator', () => {
  describe('generateNavigationFeed', () => {
    test('should generate valid navigation feed XML', () => {
      const feed: OPDSFeed = {
        id: 'urn:test:root',
        title: 'Test Library',
        updated: '2024-01-01T00:00:00.000Z',
        links: [
          { rel: 'self', href: '/api/opds', type: 'application/atom+xml' },
        ],
        entries: [
          {
            id: 'urn:test:books',
            title: 'All Books',
            updated: '2024-01-01T00:00:00.000Z',
            authors: [{ name: 'Test' }],
            links: [
              {
                rel: 'subsection',
                href: '/api/opds/books',
                type: 'application/atom+xml',
              },
            ],
          },
        ],
      };

      const xml = generateNavigationFeed(feed);

      // Check XML declaration
      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');

      // Check namespaces
      expect(xml).toContain('xmlns="http://www.w3.org/2005/Atom"');
      expect(xml).toContain('xmlns:dcterms="http://purl.org/dc/terms/"');
      expect(xml).toContain('xmlns:opds="http://opds-spec.org/2010/catalog"');

      // Check feed elements
      expect(xml).toContain('<id>urn:test:root</id>');
      expect(xml).toContain('<title>Test Library</title>');
      expect(xml).toContain('<updated>2024-01-01T00:00:00.000Z</updated>');

      // Check entry
      expect(xml).toContain('<entry>');
      expect(xml).toContain('<id>urn:test:books</id>');
      expect(xml).toContain('<title>All Books</title>');
    });

    test('should escape XML special characters', () => {
      const feed: OPDSFeed = {
        id: 'urn:test',
        title: 'Test & <"Special"> \'Chars\'',
        updated: '2024-01-01T00:00:00.000Z',
        links: [],
        entries: [],
      };

      const xml = generateNavigationFeed(feed);

      expect(xml).toContain('Test &amp; &lt;&quot;Special&quot;&gt; &apos;Chars&apos;');
      expect(xml).not.toContain('Test & <"Special"> \'Chars\'');
    });

    test('should include subtitle if provided', () => {
      const feed: OPDSFeed = {
        id: 'urn:test',
        title: 'Test',
        subtitle: 'Test Subtitle',
        updated: '2024-01-01T00:00:00.000Z',
        links: [],
        entries: [],
      };

      const xml = generateNavigationFeed(feed);

      expect(xml).toContain('<subtitle>Test Subtitle</subtitle>');
    });

    test('should include author if provided', () => {
      const feed: OPDSFeed = {
        id: 'urn:test',
        title: 'Test',
        updated: '2024-01-01T00:00:00.000Z',
        author: { name: 'Test Author', uri: 'https://example.com' },
        links: [],
        entries: [],
      };

      const xml = generateNavigationFeed(feed);

      expect(xml).toContain('<author>');
      expect(xml).toContain('<name>Test Author</name>');
      expect(xml).toContain('<uri>https://example.com</uri>');
    });
  });

  describe('generateAcquisitionFeed', () => {
    test('should generate valid acquisition feed XML', () => {
      const feed: OPDSFeed = {
        id: 'urn:test:books',
        title: 'All Books',
        updated: '2024-01-01T00:00:00.000Z',
        totalResults: 100,
        itemsPerPage: 50,
        startIndex: 0,
        links: [
          { rel: 'self', href: '/api/opds/books', type: 'application/atom+xml' },
        ],
        entries: [],
      };

      const xml = generateAcquisitionFeed(feed);

      // Check OpenSearch namespace
      expect(xml).toContain('xmlns:opensearch="http://a9.com/-/spec/opensearch/1.1/"');

      // Check OpenSearch elements
      expect(xml).toContain('<opensearch:totalResults>100</opensearch:totalResults>');
      expect(xml).toContain('<opensearch:itemsPerPage>50</opensearch:itemsPerPage>');
      expect(xml).toContain('<opensearch:startIndex>0</opensearch:startIndex>');
    });

    test('should include book entries with acquisition links', () => {
      const feed: OPDSFeed = {
        id: 'urn:test:books',
        title: 'Books',
        updated: '2024-01-01T00:00:00.000Z',
        links: [],
        entries: [
          {
            id: 'urn:test:book:1',
            title: 'Test Book',
            updated: '2024-01-01T00:00:00.000Z',
            authors: [{ name: 'Test Author' }],
            content: {
              type: 'text',
              text: 'Book description',
            },
            links: [
              {
                rel: 'http://opds-spec.org/acquisition',
                href: '/download/1/epub',
                type: 'application/epub+zip',
                title: 'Download EPUB',
              },
            ],
          },
        ],
      };

      const xml = generateAcquisitionFeed(feed);

      expect(xml).toContain('<entry>');
      expect(xml).toContain('<title>Test Book</title>');
      expect(xml).toContain('<name>Test Author</name>');
      expect(xml).toContain('<content type="text">Book description</content>');
      expect(xml).toContain('rel="http://opds-spec.org/acquisition"');
      expect(xml).toContain('href="/download/1/epub"');
      expect(xml).toContain('type="application/epub+zip"');
    });

    test('should include DC terms', () => {
      const feed: OPDSFeed = {
        id: 'urn:test:books',
        title: 'Books',
        updated: '2024-01-01T00:00:00.000Z',
        links: [],
        entries: [
          {
            id: 'urn:test:book:1',
            title: 'Test Book',
            updated: '2024-01-01T00:00:00.000Z',
            authors: [{ name: 'Test Author' }],
            links: [],
            dcterms: {
              publisher: 'Test Publisher',
              language: 'en',
              issued: '2024-01-01',
              identifier: 'urn:isbn:1234567890',
            },
          },
        ],
      };

      const xml = generateAcquisitionFeed(feed);

      expect(xml).toContain('<dcterms:publisher>Test Publisher</dcterms:publisher>');
      expect(xml).toContain('<dcterms:language>en</dcterms:language>');
      expect(xml).toContain('<dcterms:issued>2024-01-01</dcterms:issued>');
      expect(xml).toContain('<dcterms:identifier>urn:isbn:1234567890</dcterms:identifier>');
    });

    test('should include categories', () => {
      const feed: OPDSFeed = {
        id: 'urn:test:books',
        title: 'Books',
        updated: '2024-01-01T00:00:00.000Z',
        links: [],
        entries: [
          {
            id: 'urn:test:book:1',
            title: 'Test Book',
            updated: '2024-01-01T00:00:00.000Z',
            authors: [{ name: 'Test Author' }],
            links: [],
            categories: [
              {
                term: 'fiction',
                label: 'Fiction',
                scheme: 'http://www.bisg.org/standards/bisac_subject/',
              },
            ],
          },
        ],
      };

      const xml = generateAcquisitionFeed(feed);

      expect(xml).toContain('term="fiction"');
      expect(xml).toContain('label="Fiction"');
      expect(xml).toContain('scheme="http://www.bisg.org/standards/bisac_subject/"');
    });
  });
});
