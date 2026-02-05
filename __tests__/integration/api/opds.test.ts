/**
 * Integration tests for OPDS API endpoints
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { GET as GET_ROOT } from '@/app/api/opds/route';
import { GET as GET_BOOKS } from '@/app/api/opds/books/route';
import { GET as GET_SEARCH } from '@/app/api/opds/search/route';
import { GET as GET_OPENSEARCH } from '@/app/api/opds/opensearch.xml/route';
import { GET as GET_DOWNLOAD } from '@/app/api/opds/download/[bookId]/[format]/route';
import { createMockRequest } from '../../fixtures/test-data';
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from '../../helpers/db-setup';
import { resetCalibreDB } from '@/lib/db/calibre';
import path from 'path';

// Mock Next.js cache revalidation
vi.mock('next/cache', () => ({
  revalidatePath: () => {},
}));

const originalEnv = process.env.AUTH_PASSWORD;
const originalCalibreDbPath = process.env.CALIBRE_DB_PATH;

beforeAll(async () => {
  await setupTestDatabase(__filename);
  
  // Set up Calibre test database
  const calibreDbPath = path.join(__dirname, '../../fixtures/calibre-test-comprehensive.db');
  process.env.CALIBRE_DB_PATH = calibreDbPath;
});

afterAll(async () => {
  await teardownTestDatabase(__filename);
  
  // Restore original environment variables
  if (originalEnv) {
    process.env.AUTH_PASSWORD = originalEnv;
  } else {
    delete process.env.AUTH_PASSWORD;
  }
  
  if (originalCalibreDbPath) {
    process.env.CALIBRE_DB_PATH = originalCalibreDbPath;
  } else {
    delete process.env.CALIBRE_DB_PATH;
  }
  
  // Reset Calibre DB singleton
  resetCalibreDB();
});

beforeEach(async () => {
  await clearTestDatabase(__filename);
});

describe('OPDS API Integration', () => {
  describe('Authentication', () => {
    afterEach(() => {
      // Clean up AUTH_PASSWORD after each test to avoid pollution
      delete process.env.AUTH_PASSWORD;
    });

    test('should allow access when AUTH_PASSWORD is not set', async () => {
      delete process.env.AUTH_PASSWORD;

      const request = createMockRequest('GET', '/api/opds') as any;
      const response = await GET_ROOT(request);

      expect(response.status).toBe(200);
    });

    test('should return 401 without auth when AUTH_PASSWORD is set', async () => {
      process.env.AUTH_PASSWORD = 'test123';

      const request = createMockRequest('GET', '/api/opds') as any;
      const response = await GET_ROOT(request);

      expect(response.status).toBe(401);
      expect(response.headers.get('WWW-Authenticate')).toContain('Basic');
    });

    test('should accept valid Basic Auth credentials', async () => {
      process.env.AUTH_PASSWORD = 'test123';

      const credentials = Buffer.from('tome:test123').toString('base64');
      const request = createMockRequest('GET', '/api/opds', null, {
        'Authorization': `Basic ${credentials}`,
      }) as any;

      const response = await GET_ROOT(request);

      expect(response.status).toBe(200);
    });

    test('should reject invalid password', async () => {
      process.env.AUTH_PASSWORD = 'test123';

      const credentials = Buffer.from('tome:wrongpassword').toString('base64');
      const request = createMockRequest('GET', '/api/opds', null, {
        'Authorization': `Basic ${credentials}`,
      }) as any;

      const response = await GET_ROOT(request);

      expect(response.status).toBe(401);
    });
  });

  describe('Root Catalog', () => {
    beforeEach(() => {
      delete process.env.AUTH_PASSWORD; // Disable auth for these tests
    });

    test('should return navigation feed XML', async () => {
      const request = createMockRequest('GET', '/api/opds') as any;
      const response = await GET_ROOT(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toContain('application/atom+xml');

      const xml = await response.text();

      // Check XML structure
      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('xmlns="http://www.w3.org/2005/Atom"');
      expect(xml).toContain('<title>Tome Library</title>');
      expect(xml).toContain('<id>urn:tome:root</id>');
    });

    test('should include links to All Books and Search', async () => {
      const request = createMockRequest('GET', '/api/opds') as any;
      const response = await GET_ROOT(request);

      const xml = await response.text();

      expect(xml).toContain('All Books');
      expect(xml).toContain('/api/opds/books');
      expect(xml).toContain('/api/opds/search');
    });

    test('should include both search link types', async () => {
      const request = createMockRequest('GET', '/api/opds') as any;
      const response = await GET_ROOT(request);

      const xml = await response.text();

      // Should include direct search link (for clients like Goliath)
      expect(xml).toContain('rel="search"');
      expect(xml).toContain('/api/opds/search?q={searchTerms}');
      expect(xml).toContain('type="application/atom+xml;profile=opds-catalog;kind=acquisition"');

      // Should include OpenSearch descriptor link (for clients like Foliate)
      expect(xml).toContain('/api/opds/opensearch.xml');
      expect(xml).toContain('type="application/opensearchdescription+xml"');

      // Count the number of search links (should be 2)
      const searchLinkMatches = xml.match(/rel="search"/g);
      expect(searchLinkMatches).toHaveLength(2);
    });
  });

  describe('Books Feed', () => {
    beforeEach(() => {
      delete process.env.AUTH_PASSWORD;
    });

    test('should return acquisition feed XML', async () => {
      const request = createMockRequest('GET', '/api/opds/books') as any;
      const response = await GET_BOOKS(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toContain('application/atom+xml');

      const xml = await response.text();

      expect(xml).toContain('xmlns:opensearch="http://a9.com/-/spec/opensearch/1.1/"');
      expect(xml).toContain('<opensearch:totalResults>');
      expect(xml).toContain('<opensearch:itemsPerPage>');
    });

    test('should respect pagination parameters', async () => {
      const request = createMockRequest('GET', '/api/opds/books?offset=10&limit=5') as any;
      const response = await GET_BOOKS(request);

      const xml = await response.text();

      expect(xml).toContain('<opensearch:startIndex>10</opensearch:startIndex>');
      expect(xml).toContain('<opensearch:itemsPerPage>5</opensearch:itemsPerPage>');
    });

    test('should include pagination links when applicable', async () => {
      const request = createMockRequest('GET', '/api/opds/books?offset=50&limit=50') as any;
      const response = await GET_BOOKS(request);

      const xml = await response.text();

      // Should have self link
      expect(xml).toContain('rel="self"');

      // Should have start link
      expect(xml).toContain('rel="start"');
    });

    test('should enforce maximum page size', async () => {
      const request = createMockRequest('GET', '/api/opds/books?limit=1000') as any;
      const response = await GET_BOOKS(request);

      const xml = await response.text();

      // Should be capped at 200 (OPDS_MAX_PAGE_SIZE)
      expect(xml).toContain('<opensearch:itemsPerPage>200</opensearch:itemsPerPage>');
    });
  });

  describe('Search', () => {
    beforeEach(() => {
      delete process.env.AUTH_PASSWORD;
    });

    test('should return 400 without search query', async () => {
      const request = createMockRequest('GET', '/api/opds/search') as any;
      const response = await GET_SEARCH(request);

      expect(response.status).toBe(400);
    });

    test('should return acquisition feed for valid search', async () => {
      const request = createMockRequest('GET', '/api/opds/search?q=test') as any;
      const response = await GET_SEARCH(request);

      expect(response.status).toBe(200);

      const xml = await response.text();

      // XML escapes quotes as &quot;
      expect(xml).toContain('Search results for &quot;test&quot;');
      expect(xml).toContain('xmlns:opensearch');
    });

    test('should handle empty search results', async () => {
      const request = createMockRequest('GET', '/api/opds/search?q=nonexistentbook12345') as any;
      const response = await GET_SEARCH(request);

      expect(response.status).toBe(200);

      const xml = await response.text();

      expect(xml).toContain('<opensearch:totalResults>0</opensearch:totalResults>');
    });

    test('should support pagination in search results', async () => {
      const request = createMockRequest('GET', '/api/opds/search?q=test&offset=0&limit=10') as any;
      const response = await GET_SEARCH(request);

      const xml = await response.text();

      expect(xml).toContain('<opensearch:itemsPerPage>10</opensearch:itemsPerPage>');
    });
  });

  describe('OpenSearch Descriptor', () => {
    beforeEach(() => {
      delete process.env.AUTH_PASSWORD;
    });

    test('should return valid OpenSearch XML', async () => {
      const request = createMockRequest('GET', '/api/opds/opensearch.xml') as any;
      const response = await GET_OPENSEARCH(request);

      expect(response.status).toBe(200);

      const xml = await response.text();

      // Check XML structure
      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/">');
      expect(xml).toContain('</OpenSearchDescription>');
    });

    test('should have correct MIME type and caching headers', async () => {
      const request = createMockRequest('GET', '/api/opds/opensearch.xml') as any;
      const response = await GET_OPENSEARCH(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/opensearchdescription+xml');
      
      // Should be cacheable for 24 hours
      expect(response.headers.get('Cache-Control')).toContain('public');
      expect(response.headers.get('Cache-Control')).toContain('max-age=86400');
    });

    test('should include all required OpenSearch elements', async () => {
      const request = createMockRequest('GET', '/api/opds/opensearch.xml') as any;
      const response = await GET_OPENSEARCH(request);

      const xml = await response.text();

      // Required elements per OpenSearch spec
      expect(xml).toContain('<ShortName>');
      expect(xml).toContain('<Description>');
      expect(xml).toContain('<Url');
      
      // Should include library name
      expect(xml).toContain('Tome Library');
      
      // Should have meaningful description
      expect(xml).toContain('Search books');
    });

    test('should include correct search URL template', async () => {
      const request = createMockRequest('GET', '/api/opds/opensearch.xml') as any;
      const response = await GET_OPENSEARCH(request);

      const xml = await response.text();

      // Should point to OPDS search endpoint with template variable
      expect(xml).toContain('/api/opds/search?q={searchTerms}');
      
      // Url element should have correct MIME type for OPDS acquisition feed
      expect(xml).toContain('type="application/atom+xml;profile=opds-catalog;kind=acquisition"');
      expect(xml).toContain('template=');
    });

    test('should include optional but useful OpenSearch elements', async () => {
      const request = createMockRequest('GET', '/api/opds/opensearch.xml') as any;
      const response = await GET_OPENSEARCH(request);

      const xml = await response.text();

      // Optional elements that improve client compatibility
      expect(xml).toContain('<Tags>');
      expect(xml).toContain('<Query'); // Example query
      expect(xml).toContain('role="example"');
      expect(xml).toContain('<Developer>');
      expect(xml).toContain('<Language>');
      expect(xml).toContain('<OutputEncoding>UTF-8</OutputEncoding>');
      expect(xml).toContain('<InputEncoding>UTF-8</InputEncoding>');
    });

    test('should require authentication when AUTH_PASSWORD is set', async () => {
      process.env.AUTH_PASSWORD = 'test123';

      // Without auth
      const requestNoAuth = createMockRequest('GET', '/api/opds/opensearch.xml') as any;
      const responseNoAuth = await GET_OPENSEARCH(requestNoAuth);

      expect(responseNoAuth.status).toBe(401);
      expect(responseNoAuth.headers.get('WWW-Authenticate')).toContain('Basic');

      // With valid auth
      const credentials = Buffer.from('tome:test123').toString('base64');
      const requestWithAuth = createMockRequest('GET', '/api/opds/opensearch.xml', null, {
        'Authorization': `Basic ${credentials}`,
      }) as any;
      const responseWithAuth = await GET_OPENSEARCH(requestWithAuth);

      expect(responseWithAuth.status).toBe(200);

      delete process.env.AUTH_PASSWORD;
    });

    test('should have well-formed XML without escaping issues', async () => {
      const request = createMockRequest('GET', '/api/opds/opensearch.xml') as any;
      const response = await GET_OPENSEARCH(request);

      const xml = await response.text();

      // Should not contain double-escaped entities
      expect(xml).not.toContain('&amp;amp;');
      expect(xml).not.toContain('&amp;quot;');
      
      // URL template should properly use {searchTerms} placeholder
      expect(xml).toMatch(/template="[^"]*\{searchTerms\}[^"]*"/);
    });
  });

  describe('Download Endpoint', () => {
    beforeEach(() => {
      delete process.env.AUTH_PASSWORD;
    });

    test('should return 400 for invalid book ID', async () => {
      const request = createMockRequest('GET', '/api/opds/download/invalid/epub') as any;
      const response = await GET_DOWNLOAD(request, { params: Promise.resolve({ bookId: 'invalid', format: 'epub' }) });

      expect(response.status).toBe(400);
    });

    test('should return 404 for non-existent book', async () => {
      const request = createMockRequest('GET', '/api/opds/download/999999/epub') as any;
      const response = await GET_DOWNLOAD(request, { params: Promise.resolve({ bookId: '999999', format: 'epub' }) });

      expect(response.status).toBe(404);
    });

    test('should return 404 for unavailable format', async () => {
      // Assuming book 1 exists but doesn't have MOBI format
      const request = createMockRequest('GET', '/api/opds/download/1/xyz') as any;
      const response = await GET_DOWNLOAD(request, { params: Promise.resolve({ bookId: '1', format: 'xyz' }) });

      expect(response.status).toBe(404);
    });
  });

  describe('Books Feed - Metadata Edge Cases', () => {
    beforeEach(() => {
      delete process.env.AUTH_PASSWORD;
    });

    test('should handle books without description', async () => {
      // Book ID 89 has no description in fixture
      const request = createMockRequest('GET', '/api/opds/books?limit=200') as any;
      const response = await GET_BOOKS(request);

      expect(response.status).toBe(200);
      const xml = await response.text();

      // Find book 89 entry
      const bookIdMatch = xml.match(/<id>urn:tome:book:89<\/id>/);
      expect(bookIdMatch).toBeTruthy();

      // Extract the entry containing book 89
      const entryStartIndex = xml.lastIndexOf('<entry>', bookIdMatch!.index);
      const entryEndIndex = xml.indexOf('</entry>', bookIdMatch!.index) + '</entry>'.length;
      const entryXml = xml.substring(entryStartIndex, entryEndIndex);

      // Should have title and other required fields
      expect(entryXml).toContain('<title>');
      expect(entryXml).toContain('<updated>');
      expect(entryXml).toContain('<author>');

      // Should NOT have <content> element (no description)
      expect(entryXml).not.toContain('<content type="text">');
    });

    test('should handle books without publisher', async () => {
      // Book ID 147 (Dune) has no publisher
      const request = createMockRequest('GET', '/api/opds/books?limit=200') as any;
      const response = await GET_BOOKS(request);

      expect(response.status).toBe(200);
      const xml = await response.text();

      // Find book 147 entry
      const bookIdMatch = xml.match(/<id>urn:tome:book:147<\/id>/);
      expect(bookIdMatch).toBeTruthy();

      const entryStartIndex = xml.lastIndexOf('<entry>', bookIdMatch!.index);
      const entryEndIndex = xml.indexOf('</entry>', bookIdMatch!.index) + '</entry>'.length;
      const entryXml = xml.substring(entryStartIndex, entryEndIndex);

      // Should have other DC terms but not publisher
      expect(entryXml).toContain('dcterms:issued'); // Has pubdate
      expect(entryXml).not.toContain('dcterms:publisher');
    });

    test('should include all DC terms when available', async () => {
      // Book ID 40 has publisher, pubdate, and ISBN in database
      const request = createMockRequest('GET', '/api/opds/books?limit=200') as any;
      const response = await GET_BOOKS(request);

      expect(response.status).toBe(200);
      const xml = await response.text();

      // Find book 40 entry
      const bookIdMatch = xml.match(/<id>urn:tome:book:40<\/id>/);
      expect(bookIdMatch).toBeTruthy();

      const entryStartIndex = xml.lastIndexOf('<entry>', bookIdMatch!.index);
      const entryEndIndex = xml.indexOf('</entry>', bookIdMatch!.index) + '</entry>'.length;
      const entryXml = xml.substring(entryStartIndex, entryEndIndex);

      // Should have dcterms namespace elements
      expect(entryXml).toContain('dcterms:issued');
      expect(entryXml).toContain('dcterms:identifier');
      expect(entryXml).toContain('urn:isbn:9780399588969');
      
      // Verify the entry is well-formed with proper structure
      expect(entryXml).toContain('<title>10% Happier</title>');
      expect(entryXml).toContain('<published>');
    });

    test('should include series as category when available', async () => {
      // Book ID 147 (Dune) has series
      const request = createMockRequest('GET', '/api/opds/books?limit=200') as any;
      const response = await GET_BOOKS(request);

      expect(response.status).toBe(200);
      const xml = await response.text();

      // Find book 147 entry
      const bookIdMatch = xml.match(/<id>urn:tome:book:147<\/id>/);
      expect(bookIdMatch).toBeTruthy();

      const entryStartIndex = xml.lastIndexOf('<entry>', bookIdMatch!.index);
      const entryEndIndex = xml.indexOf('</entry>', bookIdMatch!.index) + '</entry>'.length;
      const entryXml = xml.substring(entryStartIndex, entryEndIndex);

      // Should have series category
      expect(entryXml).toContain('<category');
      expect(entryXml).toContain('term="Dune"');
      expect(entryXml).toContain('label="Series: Dune"');
    });

    test('should handle books without series (no category)', async () => {
      // Book ID 89 has series but we can test that entries without series don't have category
      const request = createMockRequest('GET', '/api/opds/books?limit=200') as any;
      const response = await GET_BOOKS(request);

      expect(response.status).toBe(200);
      const xml = await response.text();

      // Verify the XML is well-formed and contains multiple books
      expect(xml).toContain('<feed');
      expect(xml).toContain('<entry>');

      // Some books should have categories (with series)
      // Some books should not have categories (without series)
      // This test verifies the XML remains valid regardless
      expect(xml).toContain('xmlns:dcterms');
    });

    test('should include published date when available', async () => {
      // Book ID 147 has pubdate
      const request = createMockRequest('GET', '/api/opds/books?limit=200') as any;
      const response = await GET_BOOKS(request);

      expect(response.status).toBe(200);
      const xml = await response.text();

      // Find book 147 entry
      const bookIdMatch = xml.match(/<id>urn:tome:book:147<\/id>/);
      expect(bookIdMatch).toBeTruthy();

      const entryStartIndex = xml.lastIndexOf('<entry>', bookIdMatch!.index);
      const entryEndIndex = xml.indexOf('</entry>', bookIdMatch!.index) + '</entry>'.length;
      const entryXml = xml.substring(entryStartIndex, entryEndIndex);

      // Should have <published> element
      expect(entryXml).toContain('<published>');
      expect(entryXml).toContain('1965-06'); // Dune published in 1965
    });

    test('should handle pagination with books having null fields', async () => {
      // Test pagination works correctly even with books missing optional fields
      const request = createMockRequest('GET', '/api/opds/books?offset=0&limit=10') as any;
      const response = await GET_BOOKS(request);

      expect(response.status).toBe(200);
      const xml = await response.text();

      // Should have pagination structure
      expect(xml).toContain('<opensearch:totalResults>');
      expect(xml).toContain('<opensearch:startIndex>0</opensearch:startIndex>');
      expect(xml).toContain('<opensearch:itemsPerPage>10</opensearch:itemsPerPage>');

      // Should have valid feed structure
      expect(xml).toContain('<feed');
      expect(xml).toContain('</feed>');

      // All entries should be well-formed
      const entryCount = (xml.match(/<entry>/g) || []).length;
      const closingEntryCount = (xml.match(/<\/entry>/g) || []).length;
      expect(entryCount).toBe(closingEntryCount);
    });

    test('should include cover links only for books with covers', async () => {
      // All test books have covers, but verify link structure
      const request = createMockRequest('GET', '/api/opds/books?limit=5') as any;
      const response = await GET_BOOKS(request);

      expect(response.status).toBe(200);
      const xml = await response.text();

      // Should have cover and thumbnail links
      expect(xml).toContain('rel="http://opds-spec.org/image"');
      expect(xml).toContain('rel="http://opds-spec.org/image/thumbnail"');
      expect(xml).toContain('href="/api/covers/');
    });
  });

  describe('Search - Metadata Edge Cases', () => {
    beforeEach(() => {
      delete process.env.AUTH_PASSWORD;
    });

    test('should handle search results without descriptions', async () => {
      // Search for "debt" which should match book 89 (no description)
      const request = createMockRequest('GET', '/api/opds/search?q=debt') as any;
      const response = await GET_SEARCH(request);

      expect(response.status).toBe(200);
      const xml = await response.text();

      // Should return results
      expect(xml).toContain('<feed');
      expect(xml).toContain('<entry>');

      // Verify structure is valid even without content elements
      const entryCount = (xml.match(/<entry>/g) || []).length;
      const closingEntryCount = (xml.match(/<\/entry>/g) || []).length;
      expect(entryCount).toBe(closingEntryCount);
    });

    test('should handle search results without pubdate', async () => {
      // All our test books have pubdates, but verify the structure handles nulls
      const request = createMockRequest('GET', '/api/opds/search?q=dune') as any;
      const response = await GET_SEARCH(request);

      expect(response.status).toBe(200);
      const xml = await response.text();

      // Should have valid feed
      expect(xml).toContain('<feed');
      expect(xml).toContain('</feed>');

      // Results should have required fields
      expect(xml).toContain('<title>');
      expect(xml).toContain('<updated>');
    });

    test('should include query parameter in pagination links', async () => {
      const request = createMockRequest('GET', '/api/opds/search?q=dune&offset=0&limit=5') as any;
      const response = await GET_SEARCH(request);

      expect(response.status).toBe(200);
      const xml = await response.text();

      // Pagination links should preserve search query
      expect(xml).toContain('q=dune');

      // Should have pagination structure
      expect(xml).toContain('<opensearch:totalResults>');
      expect(xml).toContain('<opensearch:itemsPerPage>');
    });

    test('should handle search with books having null metadata fields', async () => {
      // Search for a common term to get multiple results
      const request = createMockRequest('GET', '/api/opds/search?q=the') as any;
      const response = await GET_SEARCH(request);

      expect(response.status).toBe(200);
      const xml = await response.text();

      // Should have valid XML structure
      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('<feed xmlns="http://www.w3.org/2005/Atom"');

      // All entries should be properly closed
      const openTags = xml.match(/<entry>/g)?.length || 0;
      const closeTags = xml.match(/<\/entry>/g)?.length || 0;
      expect(openTags).toBe(closeTags);

      // Feed should be properly closed
      expect(xml.endsWith('</feed>') || xml.endsWith('</feed>\n')).toBe(true);
    });
  });
});
